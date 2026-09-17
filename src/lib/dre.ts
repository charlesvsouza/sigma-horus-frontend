// DRE comparativo entre dois períodos — mesmo agrupamento por conta do plano
// de contas que o Balancete de src/lib/closing-report.ts (`keyOf`/`groups`),
// mas calculado duas vezes (período A e B) e comparado lado a lado, em vez de
// só "período atual vs. anterior ao período" que o fechamento já faz.

export interface DrePaymentInput {
  amount: number;
  paidAt: Date;
  accountType: string | null; // 'RECEIVABLE' | 'PAYABLE'
  chartAccount?: { code: string; name: string; category: string | null } | null;
  accountTitle?: string | null;
}

export interface DreAccountTotal {
  code: string;
  name: string;
  category: string;
  type: 'REVENUE' | 'EXPENSE';
  total: number;
}

const isRevenue = (t?: string | null) => t === 'RECEIVABLE';

/** Agrupa pagamentos por conta do plano de contas dentro de [from, to]. */
export function groupPaymentsByChartAccount(payments: DrePaymentInput[], from: Date, to: Date): DreAccountTotal[] {
  const groups = new Map<string, DreAccountTotal>();
  for (const p of payments) {
    if (p.paidAt < from || p.paidAt > to) continue;
    const type: 'REVENUE' | 'EXPENSE' = isRevenue(p.accountType) ? 'REVENUE' : 'EXPENSE';
    const code = p.chartAccount?.code ?? (type === 'REVENUE' ? '1.0.00' : '2.0.00');
    const name = p.chartAccount?.name ?? p.accountTitle ?? 'Sem classificação';
    const category = p.chartAccount?.category ?? 'Sem grupo';
    const key = `${type}:${code}:${name}`;
    const g = groups.get(key) ?? { code, name, category, type, total: 0 };
    g.total += Number(p.amount);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export interface DreComparisonRow {
  code: string;
  name: string;
  category: string;
  type: 'REVENUE' | 'EXPENSE';
  valueA: number;
  valueB: number;
  variance: number; // valueA - valueB
  variancePct: number | null; // null quando valueB = 0 (variação não expressável em %)
}

export interface DreComparison {
  rows: DreComparisonRow[];
  totals: {
    revenueA: number; revenueB: number;
    expenseA: number; expenseB: number;
    netA: number; netB: number;
  };
}

/** Junta os totais de dois períodos (A = atual, B = comparação) pela mesma conta do plano de contas. */
export function compareDre(rowsA: DreAccountTotal[], rowsB: DreAccountTotal[]): DreComparison {
  const byKey = new Map<string, { code: string; name: string; category: string; type: 'REVENUE' | 'EXPENSE'; a: number; b: number }>();
  for (const r of rowsA) {
    const key = `${r.type}:${r.code}:${r.name}`;
    byKey.set(key, { code: r.code, name: r.name, category: r.category, type: r.type, a: r.total, b: 0 });
  }
  for (const r of rowsB) {
    const key = `${r.type}:${r.code}:${r.name}`;
    const existing = byKey.get(key);
    if (existing) existing.b = r.total;
    else byKey.set(key, { code: r.code, name: r.name, category: r.category, type: r.type, a: 0, b: r.total });
  }

  const rows: DreComparisonRow[] = [...byKey.values()]
    .map((r) => ({
      code: r.code,
      name: r.name,
      category: r.category,
      type: r.type,
      valueA: r.a,
      valueB: r.b,
      variance: r.a - r.b,
      variancePct: r.b !== 0 ? ((r.a - r.b) / Math.abs(r.b)) * 100 : null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const revenueA = rows.filter((r) => r.type === 'REVENUE').reduce((s, r) => s + r.valueA, 0);
  const revenueB = rows.filter((r) => r.type === 'REVENUE').reduce((s, r) => s + r.valueB, 0);
  const expenseA = rows.filter((r) => r.type === 'EXPENSE').reduce((s, r) => s + r.valueA, 0);
  const expenseB = rows.filter((r) => r.type === 'EXPENSE').reduce((s, r) => s + r.valueB, 0);

  return {
    rows,
    totals: { revenueA, revenueB, expenseA, expenseB, netA: revenueA - expenseA, netB: revenueB - expenseB },
  };
}
