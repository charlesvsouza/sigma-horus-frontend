import { NextResponse } from 'next/server';
import { prismaAdmin } from '@/lib/prisma';
import { clientIp, HIT_SQL, PEEK_SQL, PURGE_SQL, rateLimitKey, retryAfterSeconds } from '@/lib/rate-limit-core';

type Row = { count: number | bigint; resetAt: Date };

/** Conta uma ocorrência na janela e devolve o total. Falha de banco NÃO bloqueia (fail-open, com log). */
export async function hitRateLimit(key: string, windowMs: number): Promise<{ count: number; resetAt: Date } | null> {
  try {
    const rows = await prismaAdmin.$queryRawUnsafe<Row[]>(HIT_SQL, key, windowMs);
    // Faxina ocasional (1 em 200): sem cron dedicado, a tabela não cresce sem limite.
    if (Math.random() < 0.005) prismaAdmin.$executeRawUnsafe(PURGE_SQL).catch(() => {});
    return rows[0] ? { count: Number(rows[0].count), resetAt: rows[0].resetAt } : null;
  } catch (error) {
    console.error('[rate-limit] falha ao contar; requisição liberada', error);
    return null;
  }
}

/** Total atual da chave, sem contar. */
export async function peekRateLimit(key: string): Promise<{ count: number; resetAt: Date } | null> {
  try {
    const rows = await prismaAdmin.$queryRawUnsafe<Row[]>(PEEK_SQL, key);
    return rows[0] ? { count: Number(rows[0].count), resetAt: rows[0].resetAt } : null;
  } catch (error) {
    console.error('[rate-limit] falha ao ler; requisição liberada', error);
    return null;
  }
}

/**
 * Limite "toda chamada conta" (rotas públicas). Devolve a resposta 429 pronta quando o IP
 * estourou `max` na janela; `null` = pode seguir (inclusive sem IP identificável ou sem banco).
 */
export async function limitByIp(request: Request, scope: string, max: number, windowMs: number): Promise<NextResponse | null> {
  const ip = clientIp(request.headers);
  if (!ip) return null;
  const hit = await hitRateLimit(rateLimitKey(scope, ip), windowMs);
  if (!hit || hit.count <= max) return null;
  return NextResponse.json(
    { error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(hit.resetAt)) } },
  );
}
