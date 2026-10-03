// Regras puras da cobrança recorrente (sem banco) — testáveis isoladamente.
//
// Modelo: a cobrança "mãe" (isRecurring=true) guarda a próxima data (nextDueDate) e quantas
// ocorrências faltam (recurringCount; null = sem fim). Cada rodada gera UMA cobrança "filha"
// (não recorrente) e avança a mãe. A mãe não depende de estar paga: a mensalidade do mês
// seguinte nasce mesmo que a do mês corrente já tenha sido quitada — ou esteja em atraso.

/** Cobranças filhas geradas pelo código antigo tinham o sufixo `-<timestamp de 13 dígitos>` no número. */
const LEGACY_CHILD_NUMBER = /-\d{13}$/;

export function isLegacyGeneratedNumber(number: string): boolean {
  return LEGACY_CHILD_NUMBER.test(number);
}

/** Soma um intervalo (mensal/trimestral/anual) a uma data-só-dia (00:00 UTC), sem estourar o fim do mês. */
export function addInterval(date: Date, interval: string): Date {
  const months = interval === 'quarterly' ? 3 : interval === 'yearly' ? 12 : 1;
  const day = date.getUTCDate();
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

/**
 * Ocorrências já vencidas (até `today`) que ainda não foram geradas, da mais antiga para a mais
 * nova, respeitando quantas faltam. `cap` é só uma trava contra laço enorme por dado corrompido.
 */
export function pendingOccurrences(
  nextDueDate: Date,
  interval: string,
  remaining: number | null,
  today: Date,
  cap = 60,
): Date[] {
  const dates: Date[] = [];
  let due = nextDueDate;
  let left = remaining;
  while (due.getTime() <= today.getTime() && dates.length < cap && (left === null || left > 0)) {
    dates.push(due);
    due = addInterval(due, interval);
    if (left !== null) left -= 1;
  }
  return dates;
}

/**
 * Pula (sem gerar cobrança) as ocorrências já vencidas de uma mãe — usado quando o irmão volta de um
 * bloqueio: o período em que esteve bloqueado não gera mensalidade, e a recorrência recomeça no
 * próximo vencimento depois de hoje.
 */
export function skipPendingOccurrences(
  nextDueDate: Date,
  interval: string,
  remaining: number | null,
  today: Date,
): { nextDueDate: Date; remaining: number | null; isRecurring: boolean } {
  let due = nextDueDate;
  let left = remaining;
  let guard = 0;
  while (due.getTime() <= today.getTime() && (left === null || left > 0) && guard++ < 600) {
    due = addInterval(due, interval);
    if (left !== null) left -= 1;
  }
  return { nextDueDate: due, remaining: left, isRecurring: left === null || left > 0 };
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthLabel = (d: Date) => `${MONTHS_PT[d.getUTCMonth()]}/${d.getUTCFullYear()}`;

/**
 * Resumo do formulário de cobrança recorrente: o campo pede as REPETIÇÕES depois da primeira
 * (recurringCount), e o total confundia ("3 ocorrências" = 4 cobranças). Ex.: vencimento em
 * setembro, mensal, 3 → "= 4 cobranças: set/2026 a dez/2026". Em branco = sem fim.
 */
export function recurrenceSummary(dueDate: string, interval: string, repetitions: string): string {
  const raw = repetitions.trim();
  if (raw === '') return 'Em branco = sem fim: uma cobrança por período até você encerrar.';
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 'Informe 1 ou mais (ou deixe em branco para sem fim).';
  const total = n + 1;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return `= ${total} cobranças no total (a primeira + ${n}).`;
  let last = new Date(`${dueDate}T00:00:00Z`);
  const first = last;
  for (let i = 0; i < n; i++) last = addInterval(last, interval);
  return `= ${total} cobranças no total: ${monthLabel(first)} a ${monthLabel(last)}.`;
}

// ── Descrição por ocorrência ────────────────────────────────────────────────
// A recorrência copiava a descrição da 1ª cobrança para todas ("Mensalidade de setembro" em
// outubro, novembro…). Agora: {mês}/{mes} e {ano} viram o mês/ano do vencimento, e o nome do
// mês da 1ª cobrança escrito na descrição (por extenso, abreviado com ano, ou MM/AAAA) é trocado
// pelo da ocorrência, mantendo a forma em que foi escrito.

const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reaplica a caixa do original ("Setembro" → "Outubro", "SET" → "OUT"). */
function sameCase(original: string, next: string): string {
  if (original === original.toUpperCase() && original !== original.toLowerCase()) return next.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return next[0].toUpperCase() + next.slice(1);
  return next;
}

/** Resolve {mês}/{mes} e {ano} com a data do vencimento. */
export function resolveDescriptionPlaceholders(text: string, due: Date): string {
  return text
    .replace(/\{m[eê]s\}/gi, MONTHS_FULL[due.getUTCMonth()])
    .replace(/\{ano\}/gi, String(due.getUTCFullYear()));
}

/**
 * Descrição da ocorrência que vence em `due`, a partir da descrição da 1ª cobrança (que venceu
 * em `firstDue`). Só troca o mês que CORRESPONDE ao da 1ª cobrança — outro texto fica igual.
 */
export function descriptionForOccurrence(text: string | null | undefined, firstDue: Date, due: Date): string | null {
  if (!text) return text ?? null;
  let out = resolveDescriptionPlaceholders(text, due);
  const fm = firstDue.getUTCMonth();
  const fy = firstDue.getUTCFullYear();
  const nm = due.getUTCMonth();
  const ny = due.getUTCFullYear();
  const full = MONTHS_FULL[fm];
  const abbr = stripAccents(full).slice(0, 3);

  // MM/AAAA (ex.: 09/2026).
  out = out.replace(new RegExp(`(^|\\D)0?${fm + 1}/${fy}(?!\\d)`, 'g'), (_m, pre: string) => `${pre}${String(nm + 1).padStart(2, '0')}/${ny}`);
  // Nome por extenso (com ou sem acento), opcionalmente seguido do ano: "setembro", "Setembro de 2026", "setembro/2026".
  out = out.replace(new RegExp(`(^|[^\\p{L}])(${escapeRe(full)}|${escapeRe(stripAccents(full))})((?:\\s+de\\s+|/|\\s+)${fy})?(?![\\p{L}])`, 'giu'),
    (_m, pre: string, word: string, year?: string) => `${pre}${sameCase(word, MONTHS_FULL[nm])}${year ? year.replace(String(fy), String(ny)) : ''}`);
  // Abreviado só COM o ano junto ("set/2026", "set. 2026") — sozinho, "set"/"mar" podem ser outra palavra.
  out = out.replace(new RegExp(`(^|[^\\p{L}])(${abbr})(\\.?)(/|\\s+)${fy}(?!\\d)`, 'giu'),
    (_m, pre: string, word: string, dot: string, sep: string) => `${pre}${sameCase(word, stripAccents(MONTHS_FULL[nm]).slice(0, 3))}${dot}${sep}${ny}`);
  return out;
}

/** Prévia do formulário: como sairão as próximas descrições (até `limit`). Vazio sem descrição/data. */
export function occurrenceDescriptionsPreview(description: string, dueDate: string, interval: string, repetitions: string, limit = 3): string[] {
  const text = description.trim();
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return [];
  const first = new Date(`${dueDate}T00:00:00Z`);
  const raw = repetitions.trim();
  const n = raw === '' ? limit : Math.min(limit, Math.max(0, Math.floor(Number(raw)) || 0));
  const firstText = resolveDescriptionPlaceholders(text, first);
  const out: string[] = [];
  let due = first;
  for (let i = 0; i < n; i++) {
    due = addInterval(due, interval);
    out.push(descriptionForOccurrence(firstText, first, due) ?? '');
  }
  return out;
}
