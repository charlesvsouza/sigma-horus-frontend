// Aniversários e jubileus (cron daily-notifications): regras puras, testáveis.
//
// As datas do cadastro (nascimento, iniciação, elevação, exaltação, fundação) são
// "só data", gravadas à meia-noite UTC — leem-se em UTC (como formatDateOnly).
// Convertê-las para Brasília as jogava para o DIA ANTERIOR (00:00Z = 21h do dia
// antes) e a felicitação saía um dia adiantada. Só o "hoje" é de Brasília.

export interface DayParts { y: number; m: number; day: number }

/** Hoje no calendário de Brasília. */
export function todayBR(now: Date = new Date()): DayParts {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [{ value: y }, , { value: m }, , { value: day }] = f.formatToParts(now);
  return { y: Number(y), m: Number(m), day: Number(day) };
}

/** Partes de uma data "só data" do cadastro (UTC). */
export const dateOnlyParts = (d: Date): DayParts => ({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate() });

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** A data do cadastro faz aniversário hoje? 29/02 comemora em 28/02 nos anos não bissextos. */
export function isAnniversaryToday(date: Date, today: DayParts): boolean {
  const p = dateOnlyParts(date);
  if (p.m === 2 && p.day === 29 && !isLeap(today.y)) return today.m === 2 && today.day === 28;
  return p.m === today.m && p.day === today.day;
}

/** Anos completados hoje (para jubileus e fundação). */
export const yearsCompleted = (date: Date, today: DayParts) => today.y - dateOnlyParts(date).y;
