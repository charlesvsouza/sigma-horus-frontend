// Janela do histórico nas listas que carregam tudo de uma vez (Contas, Cobranças, Pagamentos).
// Com os anos, essas telas passariam de dezenas de MB de HTML (medido: 30 mil contas = 40 MB, 10 s). Por
// padrão mostram TUDO o que está em aberto + os últimos 12 meses; o resto fica a um clique ("Ver todo o
// histórico", ?historico=tudo). Os números dos relatórios não usam esta janela.

import { todayBR } from './date-only';

export const HISTORY_MONTHS = 12;

/** Início da janela: hoje (Brasília) menos 12 meses, como data-só-dia (00:00 UTC). */
export function historyCutoff(now: Date = new Date(), months: number = HISTORY_MONTHS): Date {
  const t = todayBR(now);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - months, t.getUTCDate()));
}

/** `?historico=tudo` pede o histórico completo. */
export const wantsFullHistory = (value: string | string[] | undefined): boolean => value === 'tudo';
