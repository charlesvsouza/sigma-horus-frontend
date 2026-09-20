// Núcleo do limite por IP: partes puras (sem banco), isoladas para teste.
// A persistência fica em lib/rate-limit.ts.

/**
 * IP do cliente. Na Vercel `x-real-ip` e o 1º item de `x-forwarded-for` são definidos pela
 * própria plataforma (o valor enviado pelo cliente é sobrescrito), então não dá para forjar
 * para escapar do limite. Sem cabeçalho devolve null — quem chama NÃO limita (melhor deixar
 * passar do que juntar todo mundo num balde só e bloquear a plataforma inteira).
 */
export function clientIp(headers: { get(name: string): string | null } | null | undefined): string | null {
  if (!headers) return null;
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real.slice(0, 64);
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return first ? first.slice(0, 64) : null;
}

export function rateLimitKey(scope: string, ip: string): string {
  return `${scope}:${ip}`;
}

export function retryAfterSeconds(resetAt: Date, now: number = Date.now()): number {
  return Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
}

/**
 * Janela fixa por chave, atômica no Postgres: o UPSERT incrementa (ou reinicia, se a janela
 * já venceu) e devolve o contador — duas requisições simultâneas nunca leem o mesmo valor.
 * $1 = chave, $2 = duração da janela em ms. O relógio é o do banco (sem depender da instância).
 */
export const HIT_SQL = `
INSERT INTO "RateLimit" ("key", "count", "resetAt")
VALUES ($1, 1, now() + ($2::double precision * interval '1 millisecond'))
ON CONFLICT ("key") DO UPDATE SET
  "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
  "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now()
                   THEN now() + ($2::double precision * interval '1 millisecond')
                   ELSE "RateLimit"."resetAt" END
RETURNING "count", "resetAt"`;

/** Contador atual da chave, sem incrementar (0 se não existe ou a janela venceu). */
export const PEEK_SQL = `
SELECT "count", "resetAt" FROM "RateLimit" WHERE "key" = $1 AND "resetAt" > now()`;

/** Faxina de janelas vencidas há mais de 1 dia. */
export const PURGE_SQL = `DELETE FROM "RateLimit" WHERE "resetAt" < now() - interval '1 day'`;
