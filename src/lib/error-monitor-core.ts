import { createHash } from 'node:crypto';

// Lógica pura do monitoramento de erros (sem banco): impressão digital, limpeza do texto e
// decisão de alertar. O registro em si fica em error-monitor.ts.

export type ErrorSource = 'server' | 'client';

const MAX_MESSAGE = 500;
const MAX_STACK = 3000;
const ALERT_REMINDER_MS = 24 * 60 * 60 * 1000;

/** /api/members/ckx1234abcd/block → /api/members/:id/block (ids longos e números viram :id). */
export function normalizeRoute(path: string): string {
  const clean = (path.split('?')[0] ?? '').split('#')[0] ?? '';
  return clean
    .split('/')
    .map((seg) => (/^[a-z0-9]{20,}$/i.test(seg) || /^\d+$/.test(seg) || /^[0-9a-f-]{32,36}$/i.test(seg) ? ':id' : seg))
    .join('/')
    .slice(0, 200) || '/';
}

/** Primeira linha, sem ids/números (para agrupar o "mesmo" erro) e sem tamanho absurdo. */
export function cleanMessage(message: unknown): string {
  const text = typeof message === 'string' ? message : message instanceof Error ? message.message : String(message ?? '');
  return (text.split('\n')[0] ?? '').trim().slice(0, MAX_MESSAGE) || '(sem mensagem)';
}

export function cleanStack(stack: unknown): string | null {
  return typeof stack === 'string' && stack.trim() ? stack.slice(0, MAX_STACK) : null;
}

export function fingerprint(source: ErrorSource, route: string, message: string): string {
  const shape = message.replace(/[0-9a-f]{8,}/gi, '#').replace(/\d+/g, '#');
  return createHash('sha1').update(`${source}|${normalizeRoute(route)}|${shape}`).digest('hex').slice(0, 24);
}

/** Erros que não são falhas: redirecionamento/404 do Next e conexão cancelada pelo navegador. */
export function isNoise(message: string, digest?: string | null): boolean {
  if (digest && /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/.test(digest)) return true;
  return /NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|aborted|ECONNRESET|socket hang up|Failed to fetch|Load failed|NetworkError/i.test(message);
}

/** Alerta por e-mail: erro novo, erro que voltou depois de resolvido, ou lembrete de 1 por dia enquanto continua. */
export function shouldAlert(existing: { lastAlertedAt: Date | null; resolvedAt: Date | null } | null, now: Date): boolean {
  if (!existing) return true;
  if (existing.resolvedAt) return true;
  if (!existing.lastAlertedAt) return true;
  return now.getTime() - existing.lastAlertedAt.getTime() >= ALERT_REMINDER_MS;
}
