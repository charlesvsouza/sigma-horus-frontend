// Regras puras da cobrança recorrente (sem banco) — testáveis isoladamente.
//
// Modelo: a cobrança "mãe" (isRecurring=true) guarda a próxima data (nextDueDate) e quantas
// ocorrências faltam (recurringCount; null = sem fim). Cada rodada gera UMA cobrança "filha"
// (não recorrente) e avança a mãe. A mãe não depende de estar paga: a mensalidade do mês
// seguinte nasce mesmo que a do mês corrente já tenha sido quitada — ou esteja em atraso.

/** Antecedência: cada ocorrência é gerada até 10 dias antes do vencimento (com o vencimento já correto). */
export const RECURRING_LEAD_DAYS = 10;

/** Última data de vencimento que a rodada de hoje já pode gerar (hoje + antecedência). */
export function recurringHorizon(today: Date, leadDays: number = RECURRING_LEAD_DAYS): Date {
  return new Date(today.getTime() + leadDays * 86_400_000);
}

/** Cobranças filhas geradas pelo código antigo tinham o sufixo `-<timestamp de 13 dígitos>` no número. */
const LEGACY_CHILD_NUMBER = /-\d{13}$/;

export function isLegacyGeneratedNumber(number: string): boolean {
  return LEGACY_CHILD_NUMBER.test(number);
}

/** Meses de um intervalo (mensal 1, trimestral 3, anual 12). */
export const intervalMonths = (interval: string) => (interval === 'quarterly' ? 3 : interval === 'yearly' ? 12 : 1);

/** Soma um intervalo (mensal/trimestral/anual) a uma data-só-dia (00:00 UTC), sem estourar o fim do mês. */
export function addInterval(date: Date, interval: string): Date {
  return shiftMonths(date, intervalMonths(interval));
}

/** Soma (ou subtrai, se negativo) meses a uma data-só-dia, limitando o dia ao fim do mês. */
export function shiftMonths(date: Date, months: number): Date {
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

/** Dias de aviso antes de a recorrência acabar: a diretoria é avisada quando a última cobrança está a até 30 dias. */
export const RECURRENCE_END_NOTICE_DAYS = 30;

/**
 * Vencimento da ÚLTIMA ocorrência que a mãe ainda vai gerar (`remaining` = repetições que faltam).
 * null = sem fim, ou nada mais a gerar.
 */
export function lastOccurrenceDue(nextDueDate: Date, interval: string, remaining: number | null): Date | null {
  if (remaining === null || remaining <= 0) return null;
  return shiftMonths(nextDueDate, intervalMonths(interval) * (remaining - 1));
}

/**
 * Renova uma mãe por mais `repetitions` ocorrências. Mãe ativa: soma às que faltam. Mãe já encerrada
 * (nextDueDate = o vencimento seguinte ao da última): recomeça no próximo vencimento a partir de hoje,
 * sem despejar de uma vez os meses que ficaram sem cobrança.
 */
export function renewRecurrence(
  mother: { nextDueDate: Date; interval: string; remaining: number | null; isRecurring: boolean },
  repetitions: number,
  today: Date,
): { nextDueDate: Date; remaining: number; isRecurring: true } {
  if (mother.isRecurring && mother.remaining !== null && mother.remaining > 0) {
    return { nextDueDate: mother.nextDueDate, remaining: mother.remaining + repetitions, isRecurring: true };
  }
  let due = mother.nextDueDate;
  let guard = 0;
  while (due.getTime() < today.getTime() && guard++ < 600) due = addInterval(due, mother.interval);
  return { nextDueDate: due, remaining: repetitions, isRecurring: true };
}

/** Mãe já encerrada continua listada por este tempo, para dar tempo de renovar. */
export const ENDED_LISTED_DAYS = 90;
const DAY_MS = 86_400_000;

export interface MotherLike {
  number: string;
  nextDueDate: Date | null;
  recurringInterval: string | null;
  recurringCount: number | null;
  isRecurring: boolean;
}

/** Vencimento da última cobrança do período da mãe e se ela já encerrou (nextDueDate = o vencimento seguinte ao da última). */
export function describeMother(row: MotherLike): { lastDue: Date; ended: boolean } | null {
  if (!row.nextDueDate || isLegacyGeneratedNumber(row.number)) return null;
  const interval = row.recurringInterval ?? 'monthly';
  if (row.isRecurring) {
    const lastDue = lastOccurrenceDue(row.nextDueDate, interval, row.recurringCount);
    return lastDue ? { lastDue, ended: false } : null;
  }
  return { lastDue: shiftMonths(row.nextDueDate, -intervalMonths(interval)), ended: true };
}

/** Quem está perto do fim (≤ 30 dias da última cobrança) ou acabou de encerrar (≤ 90 dias), da mais antiga para a mais nova. */
export function selectEnding<T extends MotherLike>(rows: T[], today: Date): (T & { lastDue: Date; ended: boolean })[] {
  const horizon = today.getTime() + RECURRENCE_END_NOTICE_DAYS * DAY_MS;
  const floor = today.getTime() - ENDED_LISTED_DAYS * DAY_MS;
  const out: (T & { lastDue: Date; ended: boolean })[] = [];
  for (const row of rows) {
    const d = describeMother(row);
    if (!d) continue;
    const t = d.lastDue.getTime();
    if (d.ended ? t >= floor : t <= horizon) out.push({ ...row, ...d });
  }
  return out.sort((a, b) => a.lastDue.getTime() - b.lastDue.getTime() || a.number.localeCompare(b.number));
}

const MONTHS_FULL_NOTICE = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
/** Texto do aviso à diretoria. `lastDues` = vencimento da última cobrança de cada mãe que está acabando. */
export function endNoticeText(lodgeName: string, lastDues: Date[]): { subject: string; body: string } {
  const byMonth = new Map<string, number>();
  for (const d of lastDues) {
    const key = `${MONTHS_FULL_NOTICE[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const lines = [...byMonth.entries()].map(([m, n]) => `• ${n} ${n === 1 ? 'recorrência termina' : 'recorrências terminam'} em ${m}`).join('\n');
  const last = new Date(Math.max(...lastDues.map((d) => d.getTime())));
  return {
    subject: `Recorrência de cobranças chegando ao fim — ${lodgeName}`,
    body: [
      `O período programado das cobranças recorrentes (mensalidades) de ${lodgeName} está chegando ao fim.`,
      lines,
      `A última cobrança sai com vencimento em ${dmy(last)}. Depois disso o sistema deixa de gerar novas cobranças para esses irmãos.`,
      'O que deseja fazer?\n' +
        '1) Renovar o período atual (mesmo valor, mais alguns meses): Tesouraria → Cobranças → "Recorrências chegando ao fim" → Renovar.\n' +
        '2) Criar outro período, com novo valor ou novas datas: Tesouraria → Cobranças → Nova cobrança (ou Cobrança em massa) → "Criar como cobrança recorrente".',
      'A renovação é feita pelo Tesoureiro ou pelo Administrador.',
    ].join('\n\n'),
  };
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
