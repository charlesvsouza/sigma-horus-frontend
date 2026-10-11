import { auth } from '@/lib/auth';
import { firstInvalidDate, INVALID_DATE_MESSAGE, todayBR } from '@/lib/date-only';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { findClosedTermForDate } from '@/lib/term-lock';
import { settleAccountAsPaid } from '@/lib/account-status';
import { isValidMoney, round2 } from '@/lib/money';
import { blockedMemberError } from '@/lib/member-block-server';
import { readProofRef } from '@/lib/payment-proof';
import { notifyApprovers } from '@/lib/expense-approval-server';
import { NextResponse } from 'next/server';

// Só 'paid' dispara a baixa; qualquer outro texto criaria conta "paga" sem Payment.
const ACCOUNT_STATUSES = ['pending', 'paid'];

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
    db.account.findMany({
      where: { lodgeId: String(lodgeId) },
      include: {
        member: { select: { id: true, name: true } },
        counterparty: { select: { id: true, name: true, kind: true } },
        chartAccount: { select: { id: true, code: true, name: true, category: true } },
        bankAccount: { select: { id: true, name: true, kind: true } },
      },
      orderBy: { dueDate: 'asc' },
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

  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });
  const badDate = firstInvalidDate(body, ['dueDate', 'paidAt']);
  if (badDate) return NextResponse.json({ error: `${INVALID_DATE_MESSAGE} (campo: ${badDate})` }, { status: 400 });
  const title = String(body?.title ?? '').trim();
  const type = String(body?.type ?? 'RECEIVABLE').trim().toUpperCase();
  const rawAmount = Number(body?.amount ?? 0);
  const amount = round2(rawAmount);
  const dueDate = body?.dueDate ? new Date(body.dueDate) : todayBR();
  const status = String(body?.status ?? 'pending').trim().toLowerCase();
  const description = String(body?.description ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;
  const counterpartyId = body?.counterpartyId ? String(body.counterpartyId) : null;
  const chartAccountId = body?.chartAccountId ? String(body.chartAccountId) : null;
  const bankAccountId = body?.bankAccountId ? String(body.bankAccountId) : null;
  const isDues = Boolean(body?.isDues);
  const paidAt = body?.paidAt ? new Date(body.paidAt) : todayBR();
  // Comprovante da baixa (despesa lançada já como paga): enviado antes por /api/payment-proofs.
  const proof = readProofRef(String(lodgeId), body);
  if (!proof.ok) return NextResponse.json({ error: proof.error }, { status: 400 });

  if (!title || !['RECEIVABLE', 'PAYABLE'].includes(type)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  // round2 sozinho aceitaria 12,345 e gravaria 12,35 em silêncio: valida o valor bruto.
  if (!isValidMoney(rawAmount)) {
    return NextResponse.json({ error: 'Informe um valor maior que zero, com até 2 casas decimais.' }, { status: 400 });
  }
  if (!ACCOUNT_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Situação inválida: use pendente ou paga.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    // Trava de período: não permite lançar em veneralato já encerrado.
    const locked = await findClosedTermForDate(db, String(lodgeId), dueDate);
    if (locked) return { locked } as const;

    // O irmão informado precisa ser desta loja (a chave estrangeira sozinha não confere o isolamento entre lojas).
    if (memberId && !(await db.member.findFirst({ where: { id: memberId, lodgeId: String(lodgeId) }, select: { id: true } }))) return { invalidMember: true } as const;

    // Irmão bloqueado (comunicado à Potência) não recebe lançamento novo: a regularização é pelo acordo.
    if (type === 'RECEIVABLE' && memberId) {
      const blockedError = await blockedMemberError(db, String(lodgeId), memberId);
      if (blockedError) return { blockedError } as const;
    }

    // Garante que o plano de contas informado pertence à loja.
    let validChartId: string | null = null;
    let chartIsDues = false;
    if (chartAccountId) {
      const chart = await db.chartAccount.findFirst({ where: { id: chartAccountId, lodgeId: String(lodgeId) }, select: { id: true, isDues: true } });
      validChartId = chart?.id ?? null;
      chartIsDues = chart?.isDues ?? false;
    }
    // Mensalidade é sempre de um irmão: sem o vínculo, não entra no Art. 002 de ninguém.
    if ((isDues || chartIsDues) && type === 'RECEIVABLE' && !memberId) return { duesNoMember: true } as const;

    // Garante que a contraparte informada pertence à loja.
    let validCounterpartyId: string | null = null;
    if (counterpartyId) {
      const cp = await db.counterparty.findFirst({ where: { id: counterpartyId, lodgeId: String(lodgeId) }, select: { id: true } });
      validCounterpartyId = cp?.id ?? null;
    }

    // Garante que a conta bancária/caixa prevista pertence à loja.
    let validBankAccountId: string | null = null;
    if (bankAccountId) {
      const ba = await db.financialAccount.findFirst({ where: { id: bankAccountId, lodgeId: String(lodgeId) }, select: { id: true } });
      validBankAccountId = ba?.id ?? null;
    }

    // Visto do Venerável: despesa acima do limite configurado nasce "pending"
    // e só pode ser paga depois de aprovada (ver POST /api/accounts/[id]/approve).
    let approvalStatus = 'approved';
    let dualApproval = false;
    let lodgeName = '';
    if (type === 'PAYABLE') {
      const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { expenseApprovalThreshold: true, expenseDualApproval: true, name: true } });
      const threshold = lodge?.expenseApprovalThreshold;
      if (threshold != null && amount >= threshold) approvalStatus = 'pending';
      dualApproval = Boolean(lodge?.expenseDualApproval);
      lodgeName = lodge?.name ?? '';
    }

    const created = await db.account.create({
      data: {
        lodgeId: String(lodgeId),
        title,
        type,
        amount,
        dueDate,
        status,
        description: description || null,
        memberId,
        counterpartyId: validCounterpartyId,
        chartAccountId: validChartId,
        bankAccountId: validBankAccountId,
        isDues: isDues || chartIsDues,
        approvalStatus,
      },
      include: {
        member: { select: { id: true, name: true } },
        counterparty: { select: { id: true, name: true, kind: true } },
        chartAccount: { select: { id: true, code: true, name: true, category: true } },
        bankAccount: { select: { id: true, name: true, kind: true } },
      },
    });

    // "Pago" precisa gerar o Payment (é ele que move o caixa/extrato/DRE). Se a
    // baixa não for possível (sem conta bancária/caixa, despesa sem visto, período
    // fechado), o lançamento não é criado.
    if (status === 'paid') {
      const settled = await settleAccountAsPaid(db, {
        lodgeId: String(lodgeId),
        account: { id: created.id, amount, memberId, type, approvalStatus },
        bankAccountId: validBankAccountId,
        paidAt,
        proof: proof.ref,
        userId: String(session.user.id),
      });
      if (!settled.ok) {
        await db.account.delete({ where: { id: created.id } });
        return { settleError: settled } as const;
      }
    }

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'account', entityId: created.id, metadata: { title, type, amount, status } });
    // Dupla aprovação: avisa quem pode aprovar (menos quem lançou); o envio é depois da transação.
    const notify = approvalStatus === 'pending' && dualApproval
      ? await notifyApprovers(db, String(lodgeId), { id: created.id, title, amount, lodgeName }, [String(session.user.id)])
      : null;
    return { created, notify } as const;
  });

  if ('invalidMember' in result) {
    return NextResponse.json({ error: 'Irmão não encontrado nesta loja.' }, { status: 400 });
  }

  if ('blockedError' in result) {
    return NextResponse.json({ error: result.blockedError }, { status: 409 });
  }

  if ('duesNoMember' in result) {
    return NextResponse.json({ error: 'Mensalidade precisa estar vinculada a um irmão. Escolha o membro em "Vincular a um membro".' }, { status: 400 });
  }

  if ('settleError' in result && result.settleError) {
    return NextResponse.json({ error: result.settleError.error }, { status: result.settleError.status });
  }

  if ('locked' in result && result.locked) {
    return NextResponse.json(
      { error: `Período encerrado (${result.locked.title}). Não é possível lançar com vencimento dentro de um veneralato já fechado.` },
      { status: 409 },
    );
  }

  if ('notify' in result && result.notify) await result.notify().catch(() => {});
  return NextResponse.json({ item: result.created });
}
