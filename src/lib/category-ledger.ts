import { round2, sumMoney } from '@/lib/money';

// Razão por categoria: todos os pagamentos lançados em cada categoria do plano de
// contas (Tronco, Doações, Mensalidades, qualquer uma), lançamento a lançamento, com
// subtotal e saldo acumulado por categoria. É a visão de "centro de custo": a
// categoria é o eixo, e o banco/caixa onde o dinheiro passou é só um atributo da linha.
// Funções puras — o carregamento do banco fica na página.

export interface LedgerPaymentInput {
  id: string;
  paidAt: Date;
  amount: number;
  /** 'RECEIVABLE' (entrada) | 'PAYABLE' (saída) — do Account ligado ao Payment. */
  accountType: string | null;
  title: string;
  /** Membro/cliente/fornecedor/doador, já mascarado conforme o papel de quem vê. */
  person: string | null;
  bank: string | null;
  method: string;
  chart: { id: string; code: string; name: string; category: string | null } | null;
}

export interface LedgerRow {
  id: string;
  date: Date;
  description: string;
  person: string | null;
  bank: string | null;
  method: string;
  in: number;
  out: number;
  /** Saldo acumulado da categoria (saldo anterior + entradas − saídas até esta linha). */
  balance: number;
}

export interface LedgerGroup {
  key: string;
  code: string;
  name: string;
  category: string;
  /** Saldo (entradas − saídas) de tudo o que foi lançado antes do período. */
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  rows: LedgerRow[];
}

export interface Ledger {
  groups: LedgerGroup[];
  totals: { opening: number; in: number; out: number; closing: number };
}

export const NO_CATEGORY_KEY = 'none';

/**
 * Monta o razão de [from, to]. `payments` deve trazer também o que veio antes de
 * `from` (vira o saldo anterior de cada categoria); o que vem depois de `to` é ignorado.
 * `direction` filtra só entradas ou só saídas (o saldo anterior segue completo).
 */
export function buildCategoryLedger(
  payments: LedgerPaymentInput[],
  from: Date,
  to: Date,
  direction: 'all' | 'in' | 'out' = 'all',
): Ledger {
  const isIn = (p: LedgerPaymentInput) => p.accountType === 'RECEIVABLE';
  const keyOf = (p: LedgerPaymentInput) => p.chart?.id ?? NO_CATEGORY_KEY;

  const byKey = new Map<string, LedgerPaymentInput[]>();
  for (const p of payments) {
    if (p.paidAt > to) continue;
    const list = byKey.get(keyOf(p)) ?? [];
    list.push(p);
    byKey.set(keyOf(p), list);
  }

  const groups: LedgerGroup[] = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime() || a.id.localeCompare(b.id));
    const before = sorted.filter((p) => p.paidAt < from);
    const opening = sumMoney(before.map((p) => (isIn(p) ? p.amount : -p.amount)));

    let running = opening;
    const rows: LedgerRow[] = [];
    for (const p of sorted) {
      if (p.paidAt < from) continue;
      if (direction === 'in' && !isIn(p)) continue;
      if (direction === 'out' && isIn(p)) continue;
      running = round2(running + (isIn(p) ? p.amount : -p.amount));
      rows.push({
        id: p.id,
        date: p.paidAt,
        description: p.title,
        person: p.person,
        bank: p.bank,
        method: p.method,
        in: isIn(p) ? p.amount : 0,
        out: isIn(p) ? 0 : p.amount,
        balance: running,
      });
    }
    if (rows.length === 0 && opening === 0) continue;

    const chart = sorted[0].chart;
    const totalIn = sumMoney(rows.map((r) => r.in));
    const totalOut = sumMoney(rows.map((r) => r.out));
    groups.push({
      key,
      code: chart?.code ?? '—',
      name: chart?.name ?? 'Sem categoria',
      category: chart?.category ?? 'Sem grupo',
      opening,
      totalIn,
      totalOut,
      closing: running,
      rows,
    });
  }

  groups.sort((a, b) => (a.key === NO_CATEGORY_KEY ? 1 : b.key === NO_CATEGORY_KEY ? -1 : a.code.localeCompare(b.code, 'pt-BR', { numeric: true })));

  return {
    groups,
    totals: {
      opening: sumMoney(groups.map((g) => g.opening)),
      in: sumMoney(groups.map((g) => g.totalIn)),
      out: sumMoney(groups.map((g) => g.totalOut)),
      closing: sumMoney(groups.map((g) => g.closing)),
    },
  };
}
