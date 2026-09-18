import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { findClosedTermForDate } from '@/lib/term-lock';
import { syncMemberArt002Status } from '@/lib/overdue';
import { isPlainAccount, syncPlainAccountStatus } from '@/lib/account-status';
import { coversAmount, isValidMoney, remainingAmount, round2 } from '@/lib/money';
import { asaasConflictBody, findOpenAsaasCharges, notifyAsaasReceivedInCash } from '@/lib/asaas-manual';
import { dispatch } from '@/lib/messaging';
import { buildLodgeChannels } from '@/lib/lodge-channels';
import { brl } from '@/lib/currency';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const items = await withTenant(String(lodgeId), (db) =>
    db.payment.findMany({
      where: { lodgeId: String(lodgeId) },
      include: {
        account: { select: { id: true, title: true, type: true } },
        member: { select: { id: true, name: true } },
        bankAccount: { select: { id: true, name: true, kind: true } },
      },
      orderBy: { paidAt: 'desc' },
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json();
  const accountId = String(body?.accountId ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;
  const amount = round2(Number(body?.amount ?? 0));
  const paidAt = body?.paidAt ? new Date(body.paidAt) : new Date();
  const method = String(body?.method ?? 'manual').trim();
  const note = String(body?.note ?? '').trim();
  const bankAccountId = body?.bankAccountId ? String(body.bankAccountId) : null;

  if (!accountId) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  if (!isValidMoney(amount)) {
    return NextResponse.json({ error: 'Informe um valor maior que zero, com até 2 casas decimais.' }, { status: 400 });
  }
  if (!bankAccountId) {
    return NextResponse.json({ error: 'Selecione a conta bancária/caixa que recebeu ou pagou este valor.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    // Trava de período: não permite baixar com data dentro de veneralato encerrado.
    const locked = await findClosedTermForDate(db, String(lodgeId), paidAt);
    if (locked) return { locked } as const;

    const account = await db.account.findFirst({
      where: { id: accountId, lodgeId: String(lodgeId) },
    });

    if (!account) {
      return { notFound: true as const };
    }
    if (account.type === 'PAYABLE' && account.approvalStatus === 'pending') {
      return { pendingApproval: true as const };
    }

    const bank = await db.financialAccount.findFirst({ where: { id: bankAccountId, lodgeId: String(lodgeId), active: true }, select: { id: true } });
    if (!bank) {
      return { invalidBank: true as const };
    }

    // Cobrança aberta no Asaas: a baixa é do Asaas. Baixa manual só com a
    // confirmação explícita de que foi recebido fora dele (depois avisamos o Asaas).
    const openCharges = await findOpenAsaasCharges(db, { accountId, memberId: memberId ?? account.memberId });
    if (openCharges.length > 0 && body?.confirmOutsideAsaas !== true) {
      return { asaasConflict: openCharges } as const;
    }

    // Não aceita pagamento acima do saldo em aberto (conta de um membro ou conta simples) —
    // barra também o clique duplicado/retentativa que lançaria a baixa duas vezes.
    const plainAccount = await isPlainAccount(db, account);
    if (account.memberId || plainAccount) {
      const paidAgg = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId } });
      const open = remainingAmount(Number(account.amount), Number(paidAgg._sum.amount ?? 0));
      if (amount > open) return { overpay: open } as const;
    }

    const created = await db.payment.create({
      data: {
        lodgeId: String(lodgeId),
        accountId,
        memberId,
        bankAccountId: bank.id,
        amount,
        paidAt,
        method: method || 'manual',
        note: note || null,
      },
      include: {
        account: { select: { id: true, title: true, type: true } },
        member: { select: { id: true, name: true, email: true } },
        bankAccount: { select: { id: true, name: true, kind: true } },
      },
    });

    // Uma Account pode ser "de um só membro" (memberId setado — fluxo normal
    // de Contas) ou uma categoria COMPARTILHADA entre vários membros, cada um
    // com sua própria Invoice (accountId igual, memberId diferente — é assim
    // que a cobrança em massa funciona, ver /api/invoices/bulk). Nesse segundo
    // caso, somar TODOS os pagamentos da accountId e marcar TODAS as Invoices
    // como pagas quitaria por engano a mensalidade dos outros membros quando
    // só um paga — por isso o escopo muda conforme o caso.
    if (account.memberId) {
      const aggregate = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId } });
      const totalPaid = Number(aggregate._sum.amount ?? 0);
      const nextStatus = coversAmount(totalPaid, Number(account.amount)) ? 'paid' : 'pending';

      await db.account.update({ where: { id: accountId }, data: { status: nextStatus } });
      if (nextStatus === 'paid') {
        await db.invoice.updateMany({ where: { accountId, status: { not: 'paid' } }, data: { status: 'paid' } });
      }
      await syncMemberArt002Status(db, String(lodgeId), account.memberId);
    } else if (plainAccount) {
      // Conta simples (fornecedor/despesa/receita avulsa, sem membro nem cobrança):
      // quitar quando a soma dos pagamentos cobre o valor. Antes este caso ficava
      // sem tratamento e a conta permanecia "aberta" mesmo depois de paga.
      await syncPlainAccountStatus(db, { id: account.id, amount: Number(account.amount), status: account.status });
      if (memberId) await syncMemberArt002Status(db, String(lodgeId), memberId);
    } else if (memberId) {
      const memberInvoices = await db.invoice.findMany({ where: { accountId, memberId } });
      const owedByMember = memberInvoices.reduce((sum, i) => sum + Number(i.amount), 0);
      const paidByMember = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId, memberId } });
      const totalPaidByMember = Number(paidByMember._sum.amount ?? 0);

      if (owedByMember > 0 && coversAmount(totalPaidByMember, owedByMember)) {
        await db.invoice.updateMany({ where: { accountId, memberId, status: { not: 'paid' } }, data: { status: 'paid' } });
      }
      await syncMemberArt002Status(db, String(lodgeId), memberId);
    }

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'payment', entityId: created.id, metadata: { accountId, amount, method } });

    let lodgeName = 'Sua loja';
    let lodgeChannels = buildLodgeChannels(null);
    if (created.account?.type === 'RECEIVABLE' && created.member?.email) {
      const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } });
      lodgeName = lodge?.name ?? lodgeName;
      lodgeChannels = buildLodgeChannels(lodge);
    }

    return { payment: created, lodgeName, lodgeChannels, chargeIds: openCharges.map((c) => c.id) };
  });

  if ('locked' in result && result.locked) {
    return NextResponse.json(
      { error: `Período encerrado (${result.locked.title}). Não é possível baixar pagamento dentro de um veneralato já fechado.` },
      { status: 409 },
    );
  }

  if ('notFound' in result) {
    return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
  }

  if ('pendingApproval' in result) {
    return NextResponse.json({ error: 'Esta despesa está aguardando aprovação do Venerável Mestre antes de ser paga.' }, { status: 409 });
  }

  if ('invalidBank' in result) {
    return NextResponse.json({ error: 'Conta bancária/caixa inválida ou inativa.' }, { status: 400 });
  }

  if ('overpay' in result && result.overpay !== undefined) {
    return NextResponse.json(
      { error: result.overpay > 0 ? `Valor maior que o saldo em aberto desta conta (${brl(result.overpay)}).` : 'Esta conta já está quitada — não há saldo em aberto para receber ou pagar.' },
      { status: 400 },
    );
  }

  if ('asaasConflict' in result && result.asaasConflict) {
    return NextResponse.json(asaasConflictBody(result.asaasConflict), { status: 409 });
  }

  // Baixa já commitada: avisa o Asaas (rede, fora da transação) para encerrar a cobrança lá.
  const asaasWarning = await notifyAsaasReceivedInCash(String(lodgeId), result.chargeIds, paidAt).catch(() => 'Baixa registrada, mas não foi possível avisar o Asaas; encerre a cobrança manualmente no painel do Asaas.');

  // Confirmação por e-mail ao membro (recibo simples). Best-effort: falha de
  // envio não deve derrubar o registro do pagamento, que já está salvo.
  const { payment, lodgeName, lodgeChannels } = result;
  if (payment.account?.type === 'RECEIVABLE' && payment.member?.email) {
    const valor = brl(payment.amount);
    const data = new Date(payment.paidAt).toLocaleDateString('pt-BR');
    dispatch(
      'email',
      payment.member.email,
      `Pagamento confirmado — ${lodgeName}`,
      `Olá, ${payment.member.name}.\n\nConfirmamos o recebimento do seu pagamento de ${valor} em ${data}, referente a "${payment.account.title}".\n\nAtenciosamente,\n${lodgeName}`,
      lodgeChannels,
    ).catch(() => {});
  }

  return NextResponse.json({ item: payment, ...(asaasWarning ? { asaasWarning } : {}) });
}
