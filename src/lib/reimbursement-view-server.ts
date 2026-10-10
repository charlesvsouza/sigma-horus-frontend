import type { Prisma } from '@/generated/prisma/client';
import { type Actor, hasTreasuryWrite } from '@/lib/reimbursement-server';
import { canCancel, canDecide, isEditable } from '@/lib/reimbursement';
import type { BankOption, ChartOption, ReimbursementView } from '@/lib/reimbursement-view';
import { sumMoney } from '@/lib/money';

type Db = Prisma.TransactionClient;

/** Categorias de despesa da loja, para o seletor do gasto. */
export async function loadExpenseCharts(db: Db, lodgeId: string): Promise<ChartOption[]> {
  const rows = await db.chartAccount.findMany({ where: { lodgeId, type: 'EXPENSE' }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } });
  return rows.map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` }));
}

export async function loadBanks(db: Db, lodgeId: string): Promise<BankOption[]> {
  const rows = await db.financialAccount.findMany({ where: { lodgeId, active: true }, select: { id: true, name: true, isDefault: true }, orderBy: { name: 'asc' } });
  return rows.map((b) => ({ id: b.id, name: b.name, isDefault: b.isDefault }));
}

/**
 * Pedidos de reembolso com o que o usuário logado pode fazer em cada um.
 *  - `scope: 'own'`: os do próprio irmão (portal).
 *  - `scope: 'staff'`: todos os enviados da loja + os rascunhos que o próprio usuário digitou.
 */
export async function loadReimbursementViews(db: Db, actor: Actor, scope: 'own' | 'staff'): Promise<ReimbursementView[]> {
  const where: Prisma.ReimbursementWhereInput = scope === 'own'
    ? { lodgeId: actor.lodgeId, memberId: actor.memberId ?? '__none__' }
    : { lodgeId: actor.lodgeId, OR: [{ status: { not: 'draft' } }, { requestedByUserId: actor.userId }] };
  const rows = await db.reimbursement.findMany({
    where,
    include: { member: { select: { name: true, status: true } }, files: { select: { id: true, name: true, type: true, size: true }, orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  const [charts, users, debts] = await Promise.all([
    db.chartAccount.findMany({ where: { lodgeId: actor.lodgeId, id: { in: rows.map((r) => r.chartAccountId).filter((x): x is string => Boolean(x)) } }, select: { id: true, code: true, name: true } }),
    db.user.findMany({ where: { lodgeId: actor.lodgeId, id: { in: [...new Set(rows.map((r) => r.requestedByUserId))] } }, select: { id: true, name: true } }),
    // Dívida aberta do irmão só interessa a quem decide, nos pedidos que aguardam decisão.
    scope === 'staff'
      ? db.account.findMany({
          where: { lodgeId: actor.lodgeId, type: 'RECEIVABLE', status: { not: 'paid' }, memberId: { in: [...new Set(rows.filter((r) => r.status === 'awaiting_vm').map((r) => r.memberId))] } },
          select: { memberId: true, amount: true, payments: { select: { amount: true } } },
        })
      : Promise.resolve([] as { memberId: string | null; amount: number; payments: { amount: number }[] }[]),
  ]);
  const chartById = new Map(charts.map((c) => [c.id, `${c.code} — ${c.name}`]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const debtByMember = new Map<string, number>();
  for (const d of debts) {
    if (!d.memberId) continue;
    const open = Math.max(0, sumMoney([d.amount]) - sumMoney(d.payments.map((p) => p.amount)));
    debtByMember.set(d.memberId, sumMoney([debtByMember.get(d.memberId) ?? 0, open]));
  }

  const treasury = scope === 'staff' && (await hasTreasuryWrite(actor));
  return rows.map((r) => {
    const isAuthor = r.requestedByUserId === actor.userId;
    const own = Boolean(actor.memberId) && actor.memberId === r.memberId;
    return {
      id: r.id,
      status: r.status,
      memberId: r.memberId,
      memberName: r.member.name,
      memberStatus: r.member.status,
      description: r.description,
      vendorName: r.vendorName,
      amount: r.amount,
      expenseDate: r.expenseDate.toISOString().slice(0, 10),
      chartAccountId: r.chartAccountId,
      chartLabel: r.chartAccountId ? chartById.get(r.chartAccountId) ?? null : null,
      requestedVia: r.requestedVia,
      requestedByName: userName.get(r.requestedByUserId) ?? '—',
      createdAt: r.createdAt.toISOString(),
      submittedAt: r.submittedAt?.toISOString() ?? null,
      reviewNote: r.reviewNote,
      decisionNote: r.decisionNote,
      approvedAmount: r.approvedAmount,
      implicitApproval: r.implicitApproval,
      paidAt: r.paidAt?.toISOString() ?? null,
      accountId: r.accountId,
      files: r.files,
      openDebt: debtByMember.get(r.memberId) ?? 0,
      can: {
        edit: isAuthor && isEditable(r.status),
        review: treasury && r.status === 'submitted' && !isAuthor && !own,
        decide: scope === 'staff' && r.status === 'awaiting_vm' && canDecide({ role: actor.role, userId: actor.userId, memberId: actor.memberId }, r).ok,
        pay: treasury && r.status === 'approved',
        cancel: canCancel(r.status, { isAuthor, isTreasury: treasury }),
      },
    };
  });
}
