import type { Prisma } from '@/generated/prisma/client';

export interface BudgetRow {
  chartAccountId: string;
  code: string;
  name: string;
  type: string; // REVENUE | EXPENSE
  category: string | null;
  planned: number;
  /** Lançado: valor das contas com vencimento no ano, pagas ou em aberto. */
  launched: number;
  /** Liquidado: o que já foi efetivamente pago/recebido dessas contas. */
  realized: number;
  variance: number; // realized (liquidado) - planned
}

/**
 * Orçado × realizado por categoria do plano de contas, para um ano civil.
 * "Lançado" soma Account.amount por vencimento dentro do ano (mesmo critério de
 * período do relatório de fechamento: dueDate, não paidAt) e "Liquidado" soma o
 * que já foi pago dessas contas. Os dois não se misturam: conta vencida e não
 * recebida está lançada, mas não realizada.
 */
export async function getBudgetComparison(db: Prisma.TransactionClient, lodgeId: string, year: number): Promise<BudgetRow[]> {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const [chartAccounts, budgets, accounts] = await Promise.all([
    db.chartAccount.findMany({ where: { lodgeId, active: true }, orderBy: { code: 'asc' } }),
    db.budget.findMany({ where: { lodgeId, year } }),
    db.account.findMany({
      where: { lodgeId, chartAccountId: { not: null }, dueDate: { gte: from, lte: to } },
      select: { chartAccountId: true, amount: true, payments: { select: { amount: true } } },
    }),
  ]);

  const plannedByChart = new Map(budgets.map((b) => [b.chartAccountId, b.plannedAmount]));
  const launchedByChart = new Map<string, number>();
  const realizedByChart = new Map<string, number>();
  for (const a of accounts) {
    if (!a.chartAccountId) continue;
    launchedByChart.set(a.chartAccountId, (launchedByChart.get(a.chartAccountId) ?? 0) + Number(a.amount));
    const paid = a.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    realizedByChart.set(a.chartAccountId, (realizedByChart.get(a.chartAccountId) ?? 0) + Math.min(paid, Number(a.amount)));
  }

  return chartAccounts.map((c) => {
    const planned = plannedByChart.get(c.id) ?? 0;
    const launched = Math.round((launchedByChart.get(c.id) ?? 0) * 100) / 100;
    const realized = Math.round((realizedByChart.get(c.id) ?? 0) * 100) / 100;
    return { chartAccountId: c.id, code: c.code, name: c.name, type: c.type, category: c.category, planned, launched, realized, variance: Math.round((realized - planned) * 100) / 100 };
  });
}
