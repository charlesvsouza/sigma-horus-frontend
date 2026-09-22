import { round2, sumMoney } from '@/lib/money';

// Razão por categoria: todos os pagamentos lançados em cada categoria do plano de
// contas (Tronco, Doações, Mensalidades, qualquer uma), lançamento a lançamento, com
// subtotal e saldo acumulado por categoria. É a visão de "centro de custo": a
// categoria é o eixo, e o banco/caixa onde o dinheiro passou é só um atributo da linha.
// Opcionalmente entra também o que está em aberto (cobrança pendente, ainda sem
// Payment) — aparece na lista pra dar o quadro completo da categoria, mas nunca entra
// no saldo (entradas/saídas acumuladas), que continua sendo só o caixa realizado.
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

/** Cobrança/lançamento ainda pendente (Account com status != paid), sem Payment. */
export interface LedgerOpenItemInput {
  id: string;
  dueDate: Date;
  amount: number;
  accountType: string | null;
  title: string;
  person: string | null;
  /** Conta bancária/caixa PREVISTA (não é onde o dinheiro passou de fato — ainda não passou). */
  bank: string | null;
  chart: { id: string; code: string; name: string; category: string | null } | null;
}

export interface LedgerRow {
  id: string;
  date: Date;
  description: string;
  person: string | null;
  bank: string | null;
  method: string | null;
  in: number;
  out: number;
  /**
   * Saldo acumulado da categoria (saldo anterior + entradas − saídas até esta linha).
   * Em linhas `status: 'open'` é o mesmo saldo da última linha paga — a linha em
   * aberto não altera o saldo, só aparece na lista pra dar o quadro completo.
   */
  balance: number;
  /** 'paid' = já efetivado (Payment real); 'open' = cobrança pendente, ainda não paga. */
  status: 'paid' | 'open';
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
  /** Soma do que está em aberto no período (não entra no saldo). */
  openIn: number;
  openOut: number;
  rows: LedgerRow[];
  /**
   * true quando a categoria foi marcada explicitamente no filtro mas não teve nenhum
   * lançamento (pago ou em aberto) nem saldo anterior no período — a tela mostra uma
   * mensagem de "sem movimentação" em vez de sumir a categoria da lista.
   */
  empty: boolean;
}

/** Categoria pedida explicitamente no filtro, pra aparecer mesmo sem nenhum lançamento. */
export interface RequestedChart {
  id: string;
  code: string;
  name: string;
  category: string;
}

export interface Ledger {
  groups: LedgerGroup[];
  totals: { opening: number; in: number; out: number; closing: number; openIn: number; openOut: number };
}

export const NO_CATEGORY_KEY = 'none';

type Kind = 'paid' | 'open';
interface Entry {
  id: string;
  kind: Kind;
  date: Date;
  amount: number;
  accountType: string | null;
  title: string;
  person: string | null;
  bank: string | null;
  method: string | null;
  chart: { id: string; code: string; name: string; category: string | null } | null;
}

/**
 * Monta o razão de [from, to]. `payments` deve trazer também o que veio antes de
 * `from` (vira o saldo anterior de cada categoria); o que vem depois de `to` é ignorado.
 * `direction` filtra só entradas ou só saídas (o saldo anterior segue completo).
 * `openItems` (opcional) traz cobranças pendentes — entram na lista dentro do
 * período, na posição cronológica certa, mas nunca no saldo/opening/closing.
 * `requestedCharts` (opcional) são as categorias marcadas explicitamente no filtro —
 * qualquer uma delas sem nenhum lançamento no período ainda aparece no resultado,
 * como grupo `empty: true`, em vez de sumir silenciosamente da lista.
 */
export function buildCategoryLedger(
  payments: LedgerPaymentInput[],
  from: Date,
  to: Date,
  direction: 'all' | 'in' | 'out' = 'all',
  openItems: LedgerOpenItemInput[] = [],
  requestedCharts: RequestedChart[] = [],
): Ledger {
  const isIn = (e: Entry) => e.accountType === 'RECEIVABLE';
  const keyOf = (e: Entry) => e.chart?.id ?? NO_CATEGORY_KEY;

  const entries: Entry[] = [
    ...payments.map((p): Entry => ({
      id: p.id, kind: 'paid', date: p.paidAt, amount: p.amount, accountType: p.accountType,
      title: p.title, person: p.person, bank: p.bank, method: p.method, chart: p.chart,
    })),
    ...openItems.map((o): Entry => ({
      id: o.id, kind: 'open', date: o.dueDate, amount: o.amount, accountType: o.accountType,
      title: o.title, person: o.person, bank: o.bank, method: null, chart: o.chart,
    })),
  ];

  const byKey = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.date > to) continue;
    const list = byKey.get(keyOf(e)) ?? [];
    list.push(e);
    byKey.set(keyOf(e), list);
  }

  const groups: LedgerGroup[] = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
    // Saldo anterior é só do que já foi pago de fato — pendência nunca entrou no caixa.
    const before = sorted.filter((e) => e.kind === 'paid' && e.date < from);
    const opening = sumMoney(before.map((e) => (isIn(e) ? e.amount : -e.amount)));

    let running = opening;
    const rows: LedgerRow[] = [];
    for (const e of sorted) {
      if (e.date < from) continue;
      if (direction === 'in' && !isIn(e)) continue;
      if (direction === 'out' && isIn(e)) continue;
      if (e.kind === 'paid') running = round2(running + (isIn(e) ? e.amount : -e.amount));
      rows.push({
        id: e.id,
        date: e.date,
        description: e.title,
        person: e.person,
        bank: e.bank,
        method: e.method,
        in: isIn(e) ? e.amount : 0,
        out: isIn(e) ? 0 : e.amount,
        balance: running,
        status: e.kind,
      });
    }
    if (rows.length === 0 && opening === 0) continue;

    const chart = sorted[0].chart;
    const paidRows = rows.filter((r) => r.status === 'paid');
    const openRows = rows.filter((r) => r.status === 'open');
    const totalIn = sumMoney(paidRows.map((r) => r.in));
    const totalOut = sumMoney(paidRows.map((r) => r.out));
    groups.push({
      key,
      code: chart?.code ?? '—',
      name: chart?.name ?? 'Sem categoria',
      category: chart?.category ?? 'Sem grupo',
      opening,
      totalIn,
      totalOut,
      closing: running,
      openIn: sumMoney(openRows.map((r) => r.in)),
      openOut: sumMoney(openRows.map((r) => r.out)),
      rows,
      empty: false,
    });
  }

  for (const rc of requestedCharts) {
    if (groups.some((g) => g.key === rc.id)) continue;
    groups.push({
      key: rc.id, code: rc.code, name: rc.name, category: rc.category,
      opening: 0, totalIn: 0, totalOut: 0, closing: 0, openIn: 0, openOut: 0, rows: [], empty: true,
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
      openIn: sumMoney(groups.map((g) => g.openIn)),
      openOut: sumMoney(groups.map((g) => g.openOut)),
    },
  };
}
