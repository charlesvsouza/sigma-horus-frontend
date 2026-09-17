// Todas as lojas desta plataforma são brasileiras — horário de Brasília
// (UTC-3, sem horário de verão desde a lei de 2019) é a referência única de
// "horário local" usada em toda a aplicação (convocações, cron diário etc.).
const BR_OFFSET = '-03:00';

/**
 * Converte o valor de um <input type="datetime-local"> (ex.: "2026-10-01T19:30",
 * sem timezone) pro instante UTC correto, assumindo que o usuário digitou um
 * horário de Brasília. Sem isso, `new Date(valorSemFuso)` em produção (servidor
 * roda em UTC) trata o valor como se já fosse UTC, adiantando o horário salvo
 * em 3h em relação ao que a loja realmente quis dizer.
 */
export function parseBRDateTimeLocal(value: string): Date {
  const hasExplicitOffset = /Z$|[+-]\d{2}:\d{2}$/.test(value);
  return new Date(hasExplicitOffset ? value : `${value}${BR_OFFSET}`);
}
