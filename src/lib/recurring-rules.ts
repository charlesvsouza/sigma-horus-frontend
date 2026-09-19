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
 * O membro está retido no Art. 002? Sim quando a situação já é `art_002` OU quando, pela regra
 * dos dias em atraso, ele já se enquadra (a situação é sincronizada só uma vez por dia — não
 * confiamos nela sozinha para decidir se emitimos uma cobrança).
 */
export function isHeldForArt002(
  member: { status: string },
  overdueDays: number | null,
  art002Enabled: boolean,
  thresholdDays: number,
): boolean {
  if (member.status === 'art_002') return true;
  return art002Enabled && overdueDays != null && overdueDays > thresholdDays;
}
