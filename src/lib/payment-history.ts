import { sumMoney } from '@/lib/money';

// Histórico de pagamentos dos irmãos — o que cada um já pagou à loja, por data do pagamento.
// Lógica pura (testável sem Prisma). Quem vê: Tesoureiro, Administrador e Venerável (todos os
// irmãos) e cada irmão (só o próprio, no portal) — decisão do dono, 2026-09-27: o obreiro não
// fica mais "à mercê do que o tesoureiro fala". O Secretário NÃO entra (fica com os relatórios
// que já tinha).

export const PAYMENT_HISTORY_ROLES = ['admin', 'treasurer', 'venerable'] as const;

export function canSeePaymentHistory(role: string | null | undefined): boolean {
  return (PAYMENT_HISTORY_ROLES as readonly string[]).includes(role ?? '');
}

const METHOD_LABEL: Record<string, string> = {
  manual: 'Manual',
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
  asaas: 'Asaas',
  transfer: 'Transferência',
  boleto: 'Boleto',
};

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '—';
  return METHOD_LABEL[method] ?? method;
}

export interface PaymentHistoryInput {
  id: string;
  paidAt: Date;
  memberId: string | null;
  memberName: string | null;
  /** O que foi pago (título da conta: Mensalidades, Material…). */
  title: string;
  category: string | null;
  /** Vencimento da conta paga — a "competência" que o irmão reconhece. */
  dueDate: Date | null;
  method: string;
  amount: number;
}

export interface PaymentHistoryRow extends Omit<PaymentHistoryInput, 'paidAt' | 'dueDate'> {
  paidAt: string;
  dueDate: string | null;
}

export interface PaymentHistoryByMember {
  memberId: string;
  memberName: string;
  count: number;
  total: number;
}

export interface PaymentHistory {
  rows: PaymentHistoryRow[];
  total: number;
  byMember: PaymentHistoryByMember[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Limites do período no calendário de Brasília (UTC-3): de 00:00 do "de" a 23:59:59 do "até". */
export function periodBounds(from: string | null | undefined, to: string | null | undefined): { from: Date | null; to: Date | null } {
  return {
    from: from && DAY.test(from) ? new Date(`${from}T00:00:00-03:00`) : null,
    to: to && DAY.test(to) ? new Date(`${to}T23:59:59.999-03:00`) : null,
  };
}

/** Período padrão: 1º de janeiro do ano corrente até hoje (Brasília), como "AAAA-MM-DD". */
export function defaultPeriod(now: Date = new Date()): { from: string; to: string } {
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const today = br.toISOString().slice(0, 10);
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

export function buildPaymentHistory(
  input: PaymentHistoryInput[],
  filters: { from?: Date | null; to?: Date | null; memberId?: string | null },
): PaymentHistory {
  const filtered = input
    .filter((r) => !filters.from || r.paidAt >= filters.from)
    .filter((r) => !filters.to || r.paidAt <= filters.to)
    .filter((r) => !filters.memberId || r.memberId === filters.memberId)
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

  const groups = new Map<string, PaymentHistoryByMember & { amounts: number[] }>();
  for (const r of filtered) {
    if (!r.memberId) continue;
    const g = groups.get(r.memberId) ?? { memberId: r.memberId, memberName: r.memberName ?? '—', count: 0, total: 0, amounts: [] };
    g.count += 1;
    g.amounts.push(r.amount);
    groups.set(r.memberId, g);
  }
  const byMember = [...groups.values()]
    .map(({ amounts, ...g }) => ({ ...g, total: sumMoney(amounts) }))
    .sort((a, b) => a.memberName.localeCompare(b.memberName, 'pt-BR'));

  return {
    rows: filtered.map((r) => ({ ...r, paidAt: r.paidAt.toISOString(), dueDate: r.dueDate ? r.dueDate.toISOString() : null })),
    total: sumMoney(filtered.map((r) => r.amount)),
    byMember,
  };
}
