import { referenceLabel } from '@/lib/accounts-report';
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

/** Bloco com subtotal: um por mês de referência (vencimento) ou por irmão. */
export interface PaymentHistoryGroup {
  label: string;
  rows: PaymentHistoryRow[];
  total: number;
}

export interface PaymentHistory {
  rows: PaymentHistoryRow[];
  total: number;
  byMember: PaymentHistoryByMember[];
  /** null na lista corrida: ordem 'data'/'nenhuma' ou subtotais desligados. */
  groups: PaymentHistoryGroup[] | null;
}

/**
 * Ordem da lista: 'data' (padrão — data do pagamento, o modo de antes), 'referencia' (mês do
 * vencimento da conta paga, depois o nome) ou 'nome' (irmão a irmão, mês a mês).
 */
export type PaymentHistorySort = 'data' | 'referencia' | 'nome';

export const PAYMENT_HISTORY_SORT_LABEL: Record<PaymentHistorySort, string> = {
  data: 'Data do pagamento',
  referencia: 'Referência',
  nome: 'Nome',
};

export function parsePaymentHistorySort(v: string | null | undefined): PaymentHistorySort {
  return v === 'referencia' || v === 'nome' ? v : 'data';
}

/** Só Referência e Nome formam blocos; nas demais a lista é corrida. */
export function paymentSortHasGroups(sort: PaymentHistorySort): boolean {
  return sort === 'referencia' || sort === 'nome';
}

const NO_NAME = 'Sem nome';
const NO_REFERENCE = 'Sem referência';

/** Mês do vencimento como número ordenável; sem vencimento vai pro fim. */
const refMonth = (r: PaymentHistoryInput) => (r.dueDate ? r.dueDate.getUTCFullYear() * 12 + r.dueDate.getUTCMonth() : Number.MAX_SAFE_INTEGER);
const byName = (a: PaymentHistoryInput, b: PaymentHistoryInput) =>
  Number(!a.memberName) - Number(!b.memberName) || (a.memberName ?? '').localeCompare(b.memberName ?? '', 'pt-BR');
const byPaidAt = (a: PaymentHistoryInput, b: PaymentHistoryInput) => a.paidAt.getTime() - b.paidAt.getTime();

const COMPARE: Record<PaymentHistorySort, (a: PaymentHistoryInput, b: PaymentHistoryInput) => number> = {
  data: byPaidAt,
  referencia: (a, b) => refMonth(a) - refMonth(b) || byName(a, b) || byPaidAt(a, b),
  nome: (a, b) => byName(a, b) || refMonth(a) - refMonth(b) || byPaidAt(a, b),
};

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
  filters: { from?: Date | null; to?: Date | null; memberId?: string | null; sort?: PaymentHistorySort; subtotals?: boolean },
): PaymentHistory {
  // Com um irmão só, "Nome" daria um bloco único: vale a ordem padrão.
  const sort = filters.sort === 'nome' && filters.memberId ? 'data' : (filters.sort ?? 'data');
  const filtered = input
    .filter((r) => !filters.from || r.paidAt >= filters.from)
    .filter((r) => !filters.to || r.paidAt <= filters.to)
    .filter((r) => !filters.memberId || r.memberId === filters.memberId)
    .sort(COMPARE[sort]);

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

  const rows = filtered.map((r) => ({ ...r, paidAt: r.paidAt.toISOString(), dueDate: r.dueDate ? r.dueDate.toISOString() : null }));

  // Blocos consecutivos (a lista já está ordenada pela chave do bloco).
  let blocks: PaymentHistoryGroup[] | null = null;
  if (paymentSortHasGroups(sort) && filters.subtotals !== false) {
    const acc: { label: string; rows: PaymentHistoryRow[]; amounts: number[] }[] = [];
    filtered.forEach((r, i) => {
      const label = sort === 'nome' ? (r.memberName ?? NO_NAME) : (referenceLabel(r.dueDate) ?? NO_REFERENCE);
      const last = acc[acc.length - 1];
      if (last && last.label === label) {
        last.rows.push(rows[i]);
        last.amounts.push(r.amount);
      } else {
        acc.push({ label, rows: [rows[i]], amounts: [r.amount] });
      }
    });
    blocks = acc.map(({ amounts, ...g }) => ({ ...g, total: sumMoney(amounts) }));
  }

  return {
    rows,
    total: sumMoney(filtered.map((r) => r.amount)),
    byMember,
    groups: blocks,
  };
}
