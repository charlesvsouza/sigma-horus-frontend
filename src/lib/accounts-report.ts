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

export interface AccountReportFilters {
  from: Date;
  to: Date;
  personId?: string | null; // undefined/null/'' = todos
  text?: string; // busca em descrição/categoria
  amountMin?: number;
  amountMax?: number;
}

export interface AccountReport {
  rows: AccountReportRow[];
  total: number;
}

export function buildAccountsReport(rows: AccountReportRowInput[], filters: AccountReportFilters): AccountReport {
  const text = filters.text?.trim().toLowerCase();

  const filtered = rows
    .filter((r) => r.date >= filters.from && r.date <= filters.to)
    .filter((r) => !filters.personId || r.personId === filters.personId)
    .filter((r) => !text || r.description.toLowerCase().includes(text) || (r.category ?? '').toLowerCase().includes(text) || (referenceLabel(r.dueDate) ?? '').includes(text))
    .filter((r) => filters.amountMin == null || r.amount >= filters.amountMin)
    .filter((r) => filters.amountMax == null || r.amount <= filters.amountMax)
    // Pelo mês de referência (vencimento), depois o nome e a data: cada mês fica agrupado, em ordem alfabética.
    .sort((a, b) => refMonth(a) - refMonth(b)
      || (a.personName ?? '').localeCompare(b.personName ?? '', 'pt-BR')
      || a.date.getTime() - b.date.getTime());

  const out = filtered.map(({ dueDate, ...r }) => ({
    ...r,
    date: r.date.toISOString(),
    reference: referenceLabel(dueDate),
    detail: accountDetail(r.description, r.category),
  }));
  const total = out.reduce((s, r) => s + r.amount, 0);
  return { rows: out, total };
}
