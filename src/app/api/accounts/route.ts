import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { findClosedTermForDate } from '@/lib/term-lock';
import { settleAccountAsPaid } from '@/lib/account-status';
import { isValidMoney, round2 } from '@/lib/money';
import { fundAccountForChart } from '@/lib/funds';
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

  const body = await request.json();
  const title = String(body?.title ?? '').trim();
  const type = String(body?.type ?? 'RECEIVABLE').trim().toUpperCase();
  const amount = round2(Number(body?.amount ?? 0));
  const dueDate = body?.dueDate ? new Date(body.dueDate) : new Date();
  const status = String(body?.status ?? 'pending').trim();
  const description = String(body?.description ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;
  const counterpartyId = body?.counterpartyId ? String(body.counterpartyId) : null;
  const chartAccountId = body?.chartAccountId ? String(body.chartAccountId) : null;
  const bankAccountId = body?.bankAccountId ? String(body.bankAccountId) : null;
  const isDues = Boolean(body?.isDues);
  const paidAt = body?.paidAt ? new Date(body.paidAt) : new Date();

  if (!title || !['RECEIVABLE', 'PAYABLE'].includes(type)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  if (!isValidMoney(amount)) {
    return NextResponse.json({ error: 'Informe um valor maior que zero, com até 2 casas decimais.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    // Trava de período: não permite lançar em veneralato já encerrado.
    const locked = await findClosedTermForDate(db, String(lodgeId), dueDate);
    if (locked) return { locked } as const;

    // Garante que o plano de contas informado pertence à loja.
    let validChartId: string | null = null;
    let chartIsDues = false;
    if (chartAccountId) {
      const chart = await db.chartAccount.findFirst({ where: { id: chartAccountId, lodgeId: String(lodgeId) }, select: { id: true, isDues: true } });
      validChartId = chart?.id ?? null;
      chartIsDues = chart?.isDues ?? false;
    }

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
    // Categoria de fundo (Tronco / Doações): sem caixa informado, usa o caixa do fundo.
    if (!validBankAccountId && validChartId) {
      validBankAccountId = (await fundAccountForChart(db, String(lodgeId), validChartId))?.id ?? null;
    }

    // Visto do Venerável: despesa acima do limite configurado nasce "pending"
    // e só pode ser paga depois de aprovada (ver POST /api/accounts/[id]/approve).
    let approvalStatus = 'approved';
    if (type === 'PAYABLE') {
      const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { expenseApprovalThreshold: true } });
      const threshold = lodge?.expenseApprovalThreshold;
      if (threshold != null && amount >= threshold) approvalStatus = 'pending';
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
      });
      if (!settled.ok) {
        await db.account.delete({ where: { id: created.id } });
        return { settleError: settled } as const;
      }
    }

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'account', entityId: created.id, metadata: { title, type, amount, status } });
    return { created } as const;
  });

  if ('settleError' in result && result.settleError) {
    return NextResponse.json({ error: result.settleError.error }, { status: result.settleError.status });
  }

  if ('locked' in result && result.locked) {
    return NextResponse.json(
      { error: `Período encerrado (${result.locked.title}). Não é possível lançar com vencimento dentro de um veneralato já fechado.` },
      { status: 409 },
    );
  }

  return NextResponse.json({ item: result.created });
}
