import type { Prisma } from '@/generated/prisma/client';

export interface BudgetRow {
  chartAccountId: string;
  code: string;
  name: string;
  type: string; // REVENUE | EXPENSE
  category: string | null;
  planned: number;
  realized: number;
  variance: number; // realized - planned
}

/**
 * Orçado × realizado por categoria do plano de contas, para um ano civil.
 * "Realizado" soma Account.amount por vencimento dentro do ano — mesmo
 * critério de período usado no relatório de fechamento (dueDate, não paidAt).
 */
export async function getBudgetComparison(db: Prisma.TransactionClient, lodgeId: string, year: number): Promise<BudgetRow[]> {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const [chartAccounts, budgets, accounts] = await Promise.all([
    db.chartAccount.findMany({ where: { lodgeId, active: true }, orderBy: { code: 'asc' } }),
    db.budget.findMany({ where: { lodgeId, year } }),
    db.account.findMany({
      where: { lodgeId, chartAccountId: { not: null }, dueDate: { gte: from, lte: to } },
      select: { chartAccountId: true, amount: true },
    }),
  ]);

  const plannedByChart = new Map(budgets.map((b) => [b.chartAccountId, b.plannedAmount]));
  const realizedByChart = new Map<string, number>();
  for (const a of accounts) {
    if (!a.chartAccountId) continue;
    realizedByChart.set(a.chartAccountId, (realizedByChart.get(a.chartAccountId) ?? 0) + Number(a.amount));
  }

  return chartAccounts.map((c) => {
    const planned = plannedByChart.get(c.id) ?? 0;
    const realized = realizedByChart.get(c.id) ?? 0;
    return { chartAccountId: c.id, code: c.code, name: c.name, type: c.type, category: c.category, planned, realized, variance: realized - planned };
  });
}
