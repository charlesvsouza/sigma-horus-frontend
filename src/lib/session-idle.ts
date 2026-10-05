// Expiração da sessão por inatividade (decisão do dono, 2026-10-05: 30 minutos). Dois lados trabalham juntos:
// o servidor (JWT com validade de 30 min, renovada a cada chamada de /api/auth/session) e o navegador (este módulo:
// mede a atividade e renova a sessão só enquanto a pessoa está usando). Lógica pura, sem navegador, para testar.

/** Tempo parado até desconectar. Igual à validade do JWT no servidor (auth.ts). */
export const SESSION_IDLE_MS = 30 * 60 * 1000;
/** Enquanto há atividade, renova a sessão a cada 5 minutos. */
export const SESSION_HEARTBEAT_MS = 5 * 60 * 1000;
/** Aviso antes de cair. */
export const SESSION_WARNING_MS = 2 * 60 * 1000;
/** Chave compartilhada entre abas: atividade em qualquer aba mantém todas conectadas. */
export const ACTIVITY_KEY = 'sigma.lastActivity';

/** Passou o tempo ocioso desde a última atividade? */
export function isIdle(lastActivity: number, now: number): boolean {
  return now - lastActivity >= SESSION_IDLE_MS;
}

/** Faltam menos de 2 minutos para cair (e ainda não caiu)? */
export function isNearExpiry(lastActivity: number, now: number): boolean {
  const left = SESSION_IDLE_MS - (now - lastActivity);
  return left > 0 && left <= SESSION_WARNING_MS;
}

/** Renovar agora? Só com atividade recente e se já passou o intervalo desde a última renovação. */
export function shouldHeartbeat(lastActivity: number, lastBeat: number, now: number): boolean {
  return now - lastActivity < SESSION_HEARTBEAT_MS && now - lastBeat >= SESSION_HEARTBEAT_MS;
}

/** Minutos que faltam (arredondado para cima), para o aviso. */
export function minutesLeft(lastActivity: number, now: number): number {
  return Math.max(0, Math.ceil((SESSION_IDLE_MS - (now - lastActivity)) / 60_000));
}
