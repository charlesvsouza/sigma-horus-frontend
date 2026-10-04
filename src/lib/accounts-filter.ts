// Filtro da lista de Contas (a receber e a pagar) — regras puras, testáveis sem tela.
//
// Padrão único de filtro (decisão do dono, 2026-10-03): situação com contagem e valor, faixas de atraso clicáveis,
// período com atalhos, pessoa, "mais filtros" e vistas rápidas. Tudo é calculado no navegador sobre as contas já
// carregadas (em aberto + últimos 12 meses). O estado cabe na URL (serializeFilters/parseFilters) para o link
// poder ser guardado e enviado.
//
// Situação: vencida = não paga com vencimento antes de hoje (dia de Brasília); a vencer = não paga vencendo hoje ou depois.
// O status gravado quase nunca é "overdue" (ver lib/dashboard-counts.ts).

export type AccountType = 'RECEIVABLE' | 'PAYABLE';
export type Situation = 'all' | 'open' | 'overdue' | 'upcoming' | 'paid';
export type SortKey = 'due-asc' | 'due-desc' | 'amount-desc' | 'person';

export interface FilterAccount {
  id: string;
  title: string;
  type: string;
  amount: number;
  /** Quanto já foi pago da conta (pagamentos parciais). */
  paid: number;
  dueDate: string; // ISO
  status: string;
  isDues: boolean;
  description?: string | null;
  chartAccountId?: string | null;
  chartName?: string | null;
  bankAccountId?: string | null;
  personId?: string | null;
  personName?: string | null;
}

export interface Filters {
  tipo: 'all' | AccountType;
  sit: Situation;
  /** Atraso em dias (contado do vencimento até hoje): só vencidas, de `daysMin` a `daysMax` (inclusive). */
  daysMin: number | null;
  daysMax: number | null;
  from: string; // AAAA-MM-DD ou ''
  to: string;
  person: string; // id ou ''
  cat: string;    // id da categoria, 'none' (sem categoria) ou ''
  bank: string;   // id da conta bancária, 'none' ou ''
  dues: boolean;
  min: string;
  max: string;
  q: string;
  sort: SortKey;
}

export const EMPTY_FILTERS: Filters = {
  tipo: 'all', sit: 'all', daysMin: null, daysMax: null, from: '', to: '', person: '', cat: '', bank: '', dues: false, min: '', max: '', q: '', sort: 'due-asc',
};

const DAY_MS = 86_400_000;
const cents = (n: number) => Math.round(n * 100);
const dayOf = (iso: string) => { const d = new Date(iso); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Dias de atraso (0 = em dia ou vence hoje). `today` = dia civil de Brasília, 00:00 UTC. */
export function daysLate(a: Pick<FilterAccount, 'dueDate' | 'status'>, today: Date): number {
  if (a.status === 'paid') return 0;
  return Math.max(0, Math.floor((today.getTime() - dayOf(a.dueDate)) / DAY_MS));
}

export function situationOf(a: Pick<FilterAccount, 'dueDate' | 'status'>, today: Date): Exclude<Situation, 'all' | 'open'> {
  if (a.status === 'paid') return 'paid';
  return daysLate(a, today) > 0 ? 'overdue' : 'upcoming';
}

/** Valor que a linha representa: o saldo em aberto das não pagas, o valor cheio das pagas. */
export function lineValue(a: Pick<FilterAccount, 'amount' | 'paid' | 'status'>): number {
  if (a.status === 'paid') return a.amount;
  return Math.max(0, cents(a.amount) - cents(a.paid)) / 100;
}

type Ignore = 'sit' | 'days';

function matches(a: FilterAccount, f: Filters, today: Date, ignore: Ignore[] = []): boolean {
  if (f.tipo !== 'all' && a.type !== f.tipo) return false;
  const sit = situationOf(a, today);
  if (!ignore.includes('sit')) {
    if (f.sit === 'open' && sit === 'paid') return false;
    if ((f.sit === 'overdue' || f.sit === 'upcoming' || f.sit === 'paid') && sit !== f.sit) return false;
  }
  if (!ignore.includes('days') && (f.daysMin !== null || f.daysMax !== null)) {
    const late = daysLate(a, today);
    if (late <= 0) return false;
    if (f.daysMin !== null && late < f.daysMin) return false;
    if (f.daysMax !== null && late > f.daysMax) return false;
  }
  const due = dayOf(a.dueDate);
  if (f.from && due < Date.parse(`${f.from}T00:00:00Z`)) return false;
  if (f.to && due > Date.parse(`${f.to}T00:00:00Z`)) return false;
  if (f.person && a.personId !== f.person) return false;
  if (f.cat) {
    if (f.cat === 'none' ? Boolean(a.chartAccountId) : a.chartAccountId !== f.cat) return false;
  }
  if (f.bank) {
    if (f.bank === 'none' ? Boolean(a.bankAccountId) : a.bankAccountId !== f.bank) return false;
  }
  if (f.dues && !a.isDues) return false;
  const value = lineValue(a);
  const min = Number(f.min.replace(',', '.'));
  const max = Number(f.max.replace(',', '.'));
  if (f.min.trim() !== '' && Number.isFinite(min) && value < min) return false;
  if (f.max.trim() !== '' && Number.isFinite(max) && value > max) return false;
  const q = stripAccents(f.q.trim());
  if (q) {
    const hay = stripAccents(`${a.title} ${a.personName ?? ''} ${a.description ?? ''} ${a.chartName ?? ''}`);
    if (!q.split(/\s+/).every((word) => hay.includes(word))) return false;
  }
  return true;
}

export function applyFilters(accounts: FilterAccount[], f: Filters, today: Date): FilterAccount[] {
  const rows = accounts.filter((a) => matches(a, f, today));
  const byDue = (x: FilterAccount, y: FilterAccount) => x.dueDate.localeCompare(y.dueDate) || x.title.localeCompare(y.title);
  switch (f.sort) {
    case 'due-desc': return rows.sort((x, y) => byDue(y, x));
    case 'amount-desc': return rows.sort((x, y) => lineValue(y) - lineValue(x) || byDue(x, y));
    case 'person': return rows.sort((x, y) => (x.personName ?? '~').localeCompare(y.personName ?? '~', 'pt-BR') || byDue(x, y));
    default: return rows.sort(byDue);
  }
}

export interface Facet { count: number; total: number }

/** Contagem e valor de cada situação, respeitando os OUTROS filtros (ignora só a própria situação): mostra o que o clique traria. */
export function situationFacets(accounts: FilterAccount[], f: Filters, today: Date): Record<Situation, Facet> {
  const out: Record<Situation, Facet> = { all: { count: 0, total: 0 }, open: { count: 0, total: 0 }, overdue: { count: 0, total: 0 }, upcoming: { count: 0, total: 0 }, paid: { count: 0, total: 0 } };
  for (const a of accounts) {
    if (!matches(a, f, today, ['sit'])) continue;
    // as faixas de atraso (days) também valem aqui: com uma faixa escolhida só as vencidas dela entram
    const sit = situationOf(a, today);
    const v = lineValue(a);
    out.all.count++; out.all.total += v;
    if (sit !== 'paid') { out.open.count++; out.open.total += v; }
    out[sit].count++; out[sit].total += v;
  }
  for (const k of Object.keys(out) as Situation[]) out[k].total = Math.round(out[k].total * 100) / 100;
  return out;
}

export interface AgingBucket { key: string; label: string; min: number; max: number | null }
export const AGING_BUCKETS: AgingBucket[] = [
  { key: '1-30', label: '1 a 30 dias', min: 1, max: 30 },
  { key: '31-60', label: '31 a 60 dias', min: 31, max: 60 },
  { key: '61-90', label: '61 a 90 dias', min: 61, max: 90 },
  { key: '90+', label: 'Mais de 90 dias', min: 91, max: null },
];

/** Faixas de atraso sobre as vencidas que passam nos demais filtros (ignora a situação e a própria faixa). */
export function agingFacets(accounts: FilterAccount[], f: Filters, today: Date): (AgingBucket & Facet)[] {
  return AGING_BUCKETS.map((b) => {
    let count = 0, total = 0;
    for (const a of accounts) {
      if (!matches(a, f, today, ['sit', 'days']) || situationOf(a, today) !== 'overdue') continue;
      const late = daysLate(a, today);
      if (late < b.min || (b.max !== null && late > b.max)) continue;
      count++; total += lineValue(a);
    }
    return { ...b, count, total: Math.round(total * 100) / 100 };
  });
}

// ---------------------------------------------------------------------------
// Vistas rápidas
// ---------------------------------------------------------------------------

export interface QuickView { key: string; label: string; apply: (today: Date) => Partial<Filters> }

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const monthRange = (today: Date) => ({
  from: iso(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
  to: iso(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)),
});

export const QUICK_VIEWS: QuickView[] = [
  { key: 'late30', label: 'Vencidas há mais de 30 dias', apply: () => ({ sit: 'overdue', daysMin: 31, daysMax: null }) },
  { key: 'dues-month', label: 'Mensalidades do mês', apply: (t) => ({ dues: true, ...monthRange(t) }) },
  { key: 'next7', label: 'Vencem em 7 dias', apply: (t) => ({ sit: 'upcoming', from: iso(t.getTime()), to: iso(t.getTime() + 7 * DAY_MS) }) },
  { key: 'payable-late', label: 'A pagar vencidas', apply: () => ({ tipo: 'PAYABLE', sit: 'overdue' }) },
  { key: 'no-category', label: 'Sem categoria', apply: () => ({ cat: 'none' }) },
];

export const PERIOD_PRESETS: { key: string; label: string; apply: (today: Date) => Pick<Filters, 'from' | 'to'> }[] = [
  { key: 'month', label: 'Este mês', apply: (t) => monthRange(t) },
  { key: 'next30', label: 'Próximos 30 dias', apply: (t) => ({ from: iso(t.getTime()), to: iso(t.getTime() + 30 * DAY_MS) }) },
  { key: 'year', label: 'Este ano', apply: (t) => ({ from: `${t.getUTCFullYear()}-01-01`, to: `${t.getUTCFullYear()}-12-31` }) },
];

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

const SITS: Situation[] = ['all', 'open', 'overdue', 'upcoming', 'paid'];
const SORTS: SortKey[] = ['due-asc', 'due-desc', 'amount-desc', 'person'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const intOrNull = (v: string | null) => (v !== null && /^\d{1,4}$/.test(v) ? Number(v) : null);

export function parseFilters(params: { get(name: string): string | null }): Filters {
  const tipo = params.get('tipo');
  const sit = params.get('sit') as Situation | null;
  const sort = params.get('ord') as SortKey | null;
  const de = params.get('de');
  const ate = params.get('ate');
  return {
    tipo: tipo === 'RECEIVABLE' || tipo === 'PAYABLE' ? tipo : 'all',
    sit: sit && SITS.includes(sit) ? sit : 'all',
    daysMin: intOrNull(params.get('amin')),
    daysMax: intOrNull(params.get('amax')),
    from: de && DATE.test(de) ? de : '',
    to: ate && DATE.test(ate) ? ate : '',
    person: params.get('pessoa') ?? '',
    cat: params.get('cat') ?? '',
    bank: params.get('conta') ?? '',
    dues: params.get('mens') === '1',
    min: params.get('min') ?? '',
    max: params.get('max') ?? '',
    q: params.get('q') ?? '',
    sort: sort && SORTS.includes(sort) ? sort : 'due-asc',
  };
}

/** Só o que difere do padrão entra na URL (link curto). */
export function serializeFilters(f: Filters): string {
  const p = new URLSearchParams();
  if (f.tipo !== 'all') p.set('tipo', f.tipo);
  if (f.sit !== 'all') p.set('sit', f.sit);
  if (f.daysMin !== null) p.set('amin', String(f.daysMin));
  if (f.daysMax !== null) p.set('amax', String(f.daysMax));
  if (f.from) p.set('de', f.from);
  if (f.to) p.set('ate', f.to);
  if (f.person) p.set('pessoa', f.person);
  if (f.cat) p.set('cat', f.cat);
  if (f.bank) p.set('conta', f.bank);
  if (f.dues) p.set('mens', '1');
  if (f.min) p.set('min', f.min);
  if (f.max) p.set('max', f.max);
  if (f.q) p.set('q', f.q);
  if (f.sort !== 'due-asc') p.set('ord', f.sort);
  return p.toString();
}

export const isDefaultFilters = (f: Filters) => serializeFilters(f) === '';

// ---------------------------------------------------------------------------
// Descrição dos filtros (cabeçalho do relatório impresso)
// ---------------------------------------------------------------------------

const SIT_NAME: Record<Situation, string> = { all: 'todas as situações', open: 'em aberto', overdue: 'vencidas', upcoming: 'a vencer', paid: 'pagas' };
const brMoney = (v: string) => `R$ ${(Number(v.replace(',', '.')) || 0).toFixed(2).replace('.', ',')}`;
const brDate = (iso: string) => iso.split('-').reverse().join('/');

/** Linhas em português que descrevem o filtro em uso (vão no cabeçalho do relatório). Vazio = sem filtro além do padrão. */
export function describeFilters(
  f: Filters,
  lookups: { people: { id: string; name: string }[]; categories: { id: string; name: string }[]; banks: { id: string; name: string }[] },
): string[] {
  const out: string[] = [];
  if (f.tipo !== 'all') out.push(f.tipo === 'RECEIVABLE' ? 'Somente contas a receber' : 'Somente contas a pagar');
  if (f.sit !== 'all') out.push(`Situação: ${SIT_NAME[f.sit]}`);
  if (f.daysMin !== null || f.daysMax !== null) {
    const b = AGING_BUCKETS.find((x) => x.min === f.daysMin && x.max === f.daysMax);
    out.push(`Atraso: ${b ? b.label : `${f.daysMin ?? 1}${f.daysMax !== null ? ` a ${f.daysMax}` : ' ou mais'} dias`}`);
  }
  if (f.from || f.to) out.push(`Vencimento: ${f.from ? brDate(f.from) : 'início'} a ${f.to ? brDate(f.to) : 'sem limite'}`);
  if (f.person) out.push(`Pessoa: ${lookups.people.find((p) => p.id === f.person)?.name ?? '—'}`);
  if (f.cat) out.push(f.cat === 'none' ? 'Sem categoria' : `Categoria: ${lookups.categories.find((c) => c.id === f.cat)?.name ?? '—'}`);
  if (f.bank) out.push(f.bank === 'none' ? 'Sem conta bancária prevista' : `Conta: ${lookups.banks.find((c) => c.id === f.bank)?.name ?? '—'}`);
  if (f.dues) out.push('Somente mensalidades');
  if (f.min || f.max) out.push(`Valor${f.min ? ` de ${brMoney(f.min)}` : ''}${f.max ? ` até ${brMoney(f.max)}` : ''}`);
  if (f.q.trim()) out.push(`Busca: “${f.q.trim()}”`);
  return out;
}

/** Título do relatório conforme o tipo escolhido. */
export const reportTitleFor = (tipo: Filters['tipo']) => (tipo === 'RECEIVABLE' ? 'Contas a receber' : tipo === 'PAYABLE' ? 'Contas a pagar' : 'Contas a receber e a pagar');
