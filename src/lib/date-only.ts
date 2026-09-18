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
