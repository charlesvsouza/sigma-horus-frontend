// "Dia contábil" de um lançamento de caixa (Payment.paidAt, AccountTransfer.date).
//
// Esses campos misturam dois jeitos de gravar: a data digitada ("só dia", 00:00:00.000 UTC) e o instante
// real (baixas antigas do Asaas, aportes do Tronco). Filtrar por instante (`>= 28/09 00:00 UTC`) manda
// para o dia errado tudo que foi lançado entre 21h e 24h de Brasília — o extrato de UM dia saía diferente
// do extrato de um período longo. A regra abaixo é a mesma do `formatDayMixed` (o que a tela mostra):
// só-dia vale o dia em UTC; instante vale o dia de Brasília. Todo relatório de período por dia usa isto.
const DAY_MS = 86_400_000;
const BR_OFFSET_MS = 3 * 60 * 60_000; // UTC-3, sem horário de verão (ver lib/br-time.ts)

/** AAAA-MM-DD do dia contábil. */
export function ledgerDayKey(value: Date | string | number): string {
  const d = new Date(value);
  const dateOnly = d.getTime() % DAY_MS === 0;
  return new Date(dateOnly ? d.getTime() : d.getTime() - BR_OFFSET_MS).toISOString().slice(0, 10);
}

/** O dia contábil de `value` está entre `fromKey` e `toKey` (inclusive; chaves AAAA-MM-DD)? */
export function inLedgerRange(value: Date | string | number, fromKey: string, toKey: string): boolean {
  const k = ledgerDayKey(value);
  return k >= fromKey && k <= toKey;
}

/** A chave AAAA-MM-DD é um dia real do calendário? */
export function isDayKey(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw;
}

/** 00:00 UTC do dia AAAA-MM-DD — como toda data "só dia" é gravada. */
export function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** O dia de Brasília de hoje, como chave. */
export function todayKeyBR(now: Date = new Date()): string {
  return new Date(now.getTime() - BR_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Janela de consulta (instantes) que garante trazer todo lançamento cujo dia contábil está entre as chaves:
 * folga de um dia para cada lado — o filtro exato é feito depois, linha a linha, por `inLedgerRange`.
 */
export function ledgerQueryWindow(fromKey: string, toKey: string): { gte: Date; lte: Date } {
  return { gte: new Date(dayKeyToDate(fromKey).getTime() - DAY_MS), lte: new Date(dayKeyToDate(toKey).getTime() + DAY_MS + BR_OFFSET_MS) };
}

/**
 * Limites de um período de relatório por dia, para filtrar `paidAt`/`dueDate` ("só dia", 00:00 UTC): do 00:00Z do
 * primeiro dia ao último milissegundo do último. NÃO use meia-noite de Brasília (03:00Z) como início — ela deixaria
 * de fora, ou jogaria no "saldo anterior", tudo que foi lançado no primeiro dia do período.
 */
export function ledgerPeriod(fromKey: string, toKey: string): { from: Date; to: Date } {
  return { from: new Date(`${fromKey}T00:00:00.000Z`), to: new Date(`${toKey}T23:59:59.999Z`) };
}
