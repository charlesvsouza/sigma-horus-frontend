// Pontualidade das mensalidades de um mês: cada mensalidade com vencimento no mês cai em UM grupo.
//  - on_time: paga até o dia do vencimento (pagar no próprio dia é em dia)
//  - late: paga depois do vencimento
//  - open_overdue: ainda aberta e já vencida (hoje, Brasília, depois do vencimento)
//  - open_upcoming: ainda aberta, a vencer (não é inadimplência)
// Contagem por mensalidade (não por valor). Datas como "AAAA-MM-DD" (dia de Brasília).

export type PunctualityBucket = 'on_time' | 'late' | 'open_overdue' | 'open_upcoming';

export interface PunctualityDue {
  status: string;
  dueDay: string;
  /** Dia (Brasília) em que a mensalidade foi quitada — o do último pagamento. */
  paidDay: string | null;
}

/** null = fora do cálculo (cancelada). */
export function classifyDue(d: PunctualityDue, todayDay: string): PunctualityBucket | null {
  if (d.status === 'cancelled' || d.status === 'canceled') return null;
  if (d.status === 'paid') {
    if (!d.paidDay) return 'on_time';
    return d.paidDay <= d.dueDay ? 'on_time' : 'late';
  }
  return d.dueDay < todayDay ? 'open_overdue' : 'open_upcoming';
}

export interface PunctualitySummary {
  total: number;
  counts: Record<PunctualityBucket, number>;
  /** Percentuais inteiros por grupo; somam 100 (maior resto). */
  percent: Record<PunctualityBucket, number>;
  /** Pagas (em dia + depois) e abertas (vencidas + a vencer), em contagem e percentual. */
  paid: { count: number; percent: number };
  unpaid: { count: number; percent: number };
}

const BUCKETS: PunctualityBucket[] = ['on_time', 'late', 'open_overdue', 'open_upcoming'];

function largestRemainder(counts: number[], total: number): number[] {
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c * 100) / total);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) { if (left <= 0) break; floors[i]++; left--; }
  return floors;
}

export function summarizePunctuality(buckets: (PunctualityBucket | null)[]): PunctualitySummary {
  const counts: Record<PunctualityBucket, number> = { on_time: 0, late: 0, open_overdue: 0, open_upcoming: 0 };
  for (const b of buckets) if (b) counts[b]++;
  const total = BUCKETS.reduce((s, b) => s + counts[b], 0);
  const pcts = largestRemainder(BUCKETS.map((b) => counts[b]), total);
  const percent = Object.fromEntries(BUCKETS.map((b, i) => [b, pcts[i]])) as Record<PunctualityBucket, number>;
  return {
    total, counts, percent,
    paid: { count: counts.on_time + counts.late, percent: percent.on_time + percent.late },
    unpaid: { count: counts.open_overdue + counts.open_upcoming, percent: percent.open_overdue + percent.open_upcoming },
  };
}

export const BUCKET_LABEL: Record<PunctualityBucket, string> = {
  on_time: 'Pagas até o vencimento',
  late: 'Pagas após o vencimento',
  open_overdue: 'Não pagas — já vencidas',
  open_upcoming: 'Não pagas — a vencer',
};

/** "2026-10" válido → o próprio; senão o mês de `todayDay`. */
export function parseMonth(value: string | null | undefined, todayDay: string): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : todayDay.slice(0, 7);
}

export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}
