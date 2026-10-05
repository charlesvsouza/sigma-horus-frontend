// Datas "só dia" (vencimento, mandato, nascimento, marcos): o input type="date"
// manda "AAAA-MM-DD" e o servidor grava `new Date("AAAA-MM-DD")` = 00:00 UTC.
// Formatar isso no fuso do navegador (Brasil, UTC-3) mostra o DIA ANTERIOR
// (20/09 vira 19/09) — por isso estas datas são sempre formatadas em UTC.
// Já "hoje" e "vencido" são medidos no calendário de Brasília.

const DAY_MS = 86_400_000;
const BR_OFFSET_MS = 3 * 60 * 60_000; // UTC-3, sem horário de verão (ver lib/br-time.ts)

/** dd/mm/aaaa de uma data-só-dia, sem deslocar o dia. Vazio se ausente/inválida. */
export function formatDateOnly(value: Date | string | number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** A data de HOJE no calendário de Brasília, como data-só-dia (00:00 UTC). */
export function todayBR(now: Date = new Date()): Date {
  const br = new Date(now.getTime() - BR_OFFSET_MS);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()));
}

/** Normaliza para 00:00 UTC do dia (UTC) da data — comparável com `todayBR()`. */
export function dateOnlyUTC(d: Date | string | number): Date {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

/**
 * Dias de atraso de um vencimento (data-só-dia) em relação a hoje (Brasília).
 * Vence hoje → 0 (ainda em dia); venceu ontem → 1.
 */
export function daysOverdueBR(dueDate: Date | string | number, now: Date = new Date()): number {
  return Math.floor((todayBR(now).getTime() - dateOnlyUTC(dueDate).getTime()) / DAY_MS);
}

/**
 * dd/mm/aaaa de um campo que MISTURA os dois jeitos de gravar (ex.: Payment.paidAt): a data digitada
 * (00:00:00.000 UTC, "só dia") e o instante real (baixa automática do Asaas, "agora").
 * Só-dia sai no dia certo lendo em UTC; instante sai no dia de Brasília. Sem isso, qualquer um dos dois
 * aparece errado no navegador (UTC-3) ou no servidor (UTC) — o digitado volta um dia, o da noite avança.
 */
export function formatDayMixed(value: Date | string | number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const dateOnly = d.getTime() % DAY_MS === 0;
  return d.toLocaleDateString('pt-BR', { timeZone: dateOnly ? 'UTC' : 'America/Sao_Paulo' });
}

/** Anos aceitos em datas digitadas: fora disso quase sempre é erro de digitação (0001, 5138…). */
export const MIN_INPUT_YEAR = 2000;
export const MAX_INPUT_YEAR = 2100;

/**
 * Lê uma data vinda do navegador/API com rigor: só "AAAA-MM-DD" (com ou sem horário ISO), dia que existe no calendário
 * (2026-02-30 não vira 02/03 em silêncio) e ano plausível. Devolve null se não passar. "AAAA-MM-DD" = 00:00 UTC, igual
 * a `new Date("AAAA-MM-DD")` — o resto do sistema segue gravando do mesmo jeito.
 */
export function parseDateInput(raw: unknown, opts: { minYear?: number } = {}): Date | null {
  const minYear = opts.minYear ?? MIN_INPUT_YEAR;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) || raw.getUTCFullYear() < minYear || raw.getUTCFullYear() > MAX_INPUT_YEAR ? null : raw;
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < minYear || y > MAX_INPUT_YEAR) return null;
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  const parsed = new Date(raw.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Primeiro campo de data PREENCHIDO e inválido do corpo (nome do campo), ou null se todos estão ok/vazios. */
export function firstInvalidDate(body: unknown, keys: string[], opts: { minYear?: number } = {}): string | null {
  const o = (body ?? {}) as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (v === undefined || v === null || v === '') continue;
    if (parseDateInput(v, opts) === null) return k;
  }
  return null;
}

export const INVALID_DATE_MESSAGE = 'Data inválida. Informe uma data real no formato AAAA-MM-DD.';
