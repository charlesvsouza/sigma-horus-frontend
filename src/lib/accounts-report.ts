// Lógica pura dos relatórios de Contas a Receber/Pagar/Recebidas/Pagas —
// separada da rota pra ser testável sem Prisma, mesmo espírito de
// financial-accounts.ts/attendance-report.ts. As telas "abertas" (a
// receber/a pagar) filtram por data de VENCIMENTO da Account; as "liquidadas"
// (recebidas/pagas) filtram por data do PAGAMENTO — uma linha por Payment, não
// por Account, porque uma conta pode ser paga em parcelas em datas diferentes.

export interface AccountReportRowInput {
  id: string;
  date: Date; // vencimento (aberta) ou data do pagamento (liquidada)
  personId: string | null; // memberId ou counterpartyId, para o filtro "pessoa"
  personName: string | null; // já deve vir mascarado (ver lib/hospitalaria.ts) quando aplicável
  description: string;
  category: string | null; // nome da ChartAccount
  amount: number;
  /** Vencimento da conta (também nas liquidadas): define a Referência — mês/ano do vencimento. */
  dueDate?: Date | null;
}

export interface AccountReportRow extends Omit<AccountReportRowInput, 'date' | 'dueDate'> {
  date: string; // ISO
  /** Mês de referência da conta ("outubro/2026") = mês do vencimento (regra da loja). */
  reference: string | null;
  /** Título da conta só quando diz algo além da categoria ("Mensalidades" em Mensalidades some). */
  detail: string | null;
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "outubro/2026" — vencimento é data sem hora (meia-noite UTC), por isso o mês em UTC. */
export function referenceLabel(dueDate: Date | null | undefined): string | null {
  if (!dueDate || Number.isNaN(dueDate.getTime())) return null;
  return `${MONTHS[dueDate.getUTCMonth()]}/${dueDate.getUTCFullYear()}`;
}

/** Mês de referência como número ordenável (ano*12 + mês); sem vencimento, o mês da própria data. */
function refMonth(r: AccountReportRowInput): number {
  const d = r.dueDate && !Number.isNaN(r.dueDate.getTime()) ? r.dueDate : r.date;
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/** Minúsculas, sem acento. */
function plain(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Nome sem plural e sem o mês/ano do fim ("Mensalidade — Junho/2025" → "mensalidade"). */
function core(s: string): string {
  return plain(s)
    .replace(/[\s\-–—:·,/]*([a-z]+\s*\/\s*)?\d{4}$/, '')
    .replace(/[\s\-–—:·,]+$/, '')
    .replace(/s$/, '');
}

/** O título só repete a categoria (singular/plural, com ou sem o mês/ano)? Então some; senão é o detalhe. */
export function accountDetail(title: string, category: string | null): string | null {
  const t = title.trim();
  if (!t) return null;
  if (!category) return t;
  return core(t) === core(category) ? null : t;
}

/**
 * Ordem do relatório: 'referencia' (padrão — mês, depois nome), 'data' (a data da coluna:
 * vencimento nas abertas, pagamento nas liquidadas) ou 'nome' (extrato por pessoa).
 */
export type AccountsSort = 'referencia' | 'data' | 'nome';

export const ACCOUNTS_SORT_LABEL: Record<AccountsSort, string> = {
  referencia: 'Referência',
  data: 'Data',
  nome: 'Nome',
};

/** Valor vindo da URL → ordem válida (qualquer outra coisa cai no padrão). */
export function parseAccountsSort(v: string | null | undefined): AccountsSort {
  return v === 'data' || v === 'nome' ? v : 'referencia';
}

export interface AccountReportFilters {
  from: Date;
  to: Date;
  personId?: string | null; // undefined/null/'' = todos
  text?: string; // busca em descrição/categoria
  amountMin?: number;
  amountMax?: number;
  sort?: AccountsSort;
}

/** Bloco com subtotal: um por mês de referência (ordem 'referencia') ou por pessoa (ordem 'nome'). */
export interface AccountReportGroup {
  label: string;
  rows: AccountReportRow[];
  total: number;
}

export interface AccountReport {
  rows: AccountReportRow[];
  total: number;
  /** null na ordem 'data' — lista corrida, sem subtotais. */
  groups: AccountReportGroup[] | null;
}

const NO_NAME = 'Sem nome';
const NO_REFERENCE = 'Sem referência';

/** Alfabética; quem não tem nome vai pro fim. */
const byName = (a: AccountReportRowInput, b: AccountReportRowInput) =>
  Number(!a.personName) - Number(!b.personName) || (a.personName ?? '').localeCompare(b.personName ?? '', 'pt-BR');
const byDate = (a: AccountReportRowInput, b: AccountReportRowInput) => a.date.getTime() - b.date.getTime();

const COMPARE: Record<AccountsSort, (a: AccountReportRowInput, b: AccountReportRowInput) => number> = {
  // Pelo mês de referência (vencimento), depois o nome e a data: cada mês fica agrupado, em ordem alfabética.
  // Sem vencimento (pagamento avulso) vai pro fim, num bloco "Sem referência" só.
  referencia: (a, b) => Number(!referenceLabel(a.dueDate)) - Number(!referenceLabel(b.dueDate)) || refMonth(a) - refMonth(b) || byName(a, b) || byDate(a, b),
  data: (a, b) => byDate(a, b) || byName(a, b),
  // Dentro da pessoa, mês a mês.
  nome: (a, b) => byName(a, b) || refMonth(a) - refMonth(b) || byDate(a, b),
};

/**
 * Agrupa linhas JÁ ORDENADAS em blocos consecutivos. Agrupa pelo nome exibido (não pelo
 * personId): doações solidárias mascaradas viram um bloco só, sem revelar quem doou o quê.
 */
function groupRows(rows: AccountReportRow[], sort: AccountsSort): AccountReportGroup[] | null {
  if (sort === 'data') return null;
  const groups: AccountReportGroup[] = [];
  for (const r of rows) {
    const label = sort === 'nome' ? (r.personName ?? NO_NAME) : (r.reference ?? NO_REFERENCE);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.rows.push(r);
      last.total += r.amount;
    } else {
      groups.push({ label, rows: [r], total: r.amount });
    }
  }
  return groups;
}

export function buildAccountsReport(rows: AccountReportRowInput[], filters: AccountReportFilters): AccountReport {
  const text = filters.text?.trim().toLowerCase();
  const sort = filters.sort ?? 'referencia';

  const filtered = rows
    .filter((r) => r.date >= filters.from && r.date <= filters.to)
    .filter((r) => !filters.personId || r.personId === filters.personId)
    .filter((r) => !text || r.description.toLowerCase().includes(text) || (r.category ?? '').toLowerCase().includes(text) || (referenceLabel(r.dueDate) ?? '').includes(text))
    .filter((r) => filters.amountMin == null || r.amount >= filters.amountMin)
    .filter((r) => filters.amountMax == null || r.amount <= filters.amountMax)
    .sort(COMPARE[sort]);

  const out = filtered.map(({ dueDate, ...r }) => ({
    ...r,
    date: r.date.toISOString(),
    reference: referenceLabel(dueDate),
    detail: accountDetail(r.description, r.category),
  }));
  const total = out.reduce((s, r) => s + r.amount, 0);
  return { rows: out, total, groups: groupRows(out, sort) };
}
