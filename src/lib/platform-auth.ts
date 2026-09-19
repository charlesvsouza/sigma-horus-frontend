import { timingSafeEqual } from 'node:crypto';

// Comparação de segredo em tempo constante (== vaza, pelo tempo de resposta, quantos
// caracteres batem). Tamanhos diferentes já são "não" — timingSafeEqual exige o mesmo tamanho.
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Crons (Vercel Cron manda `Authorization: Bearer $CRON_SECRET`; disparo manual usa
 * PLATFORM_OWNER_TOKEN). O token NÃO é aceito na URL (?token=): URL fica em log de acesso,
 * histórico do navegador e cabeçalho Referer.
 */
export function cronAuthorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!bearer) return false;
  const accepted = [process.env.CRON_SECRET, process.env.PLATFORM_OWNER_TOKEN].filter(Boolean) as string[];
  return accepted.some((t) => safeEqual(t, bearer));
}

/** Painel do dono da plataforma (superadmin): header `x-platform-token` = PLATFORM_OWNER_TOKEN. */
export function platformAuthorized(request: Request): boolean {
  const token = process.env.PLATFORM_OWNER_TOKEN;
  if (!token) return false;
  const header = request.headers.get('x-platform-token') ?? '';
  return header.length > 0 && safeEqual(token, header);
}
