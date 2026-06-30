import { PrismaClient as GeneratedPrismaClient, Prisma } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type PrismaClient = InstanceType<typeof GeneratedPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaAdmin?: PrismaClient;
};

// Pooling para serverless (Vercel) sobre Postgres (Railway): cada instância de
// função abre seu próprio pool, então o nº de conexões = (instâncias) × (max).
// Sem limite, o adapter cai no default do node-postgres (10/instância) e pode
// estourar o max_connections do Postgres sob fan-out. Mantemos o pool pequeno e
// liberamos conexões ociosas rápido; `max` é calibrável por env sob carga
// (DB_POOL_MAX) sem alterar código. Sob carga alta o ideal é um pooler externo
// (pgBouncer) — ver sigmahorus_documentacao.md §10.
const POOL_MAX = Number(process.env.DB_POOL_MAX) || 5;
const poolTuning = {
  max: POOL_MAX,
  idleTimeoutMillis: 10_000, // devolve conexões ociosas ao Postgres rápido
  connectionTimeoutMillis: 10_000, // falha rápido em vez de pendurar a request
};

// Tenant client: connects as the NOBYPASSRLS role (`sigma_app`) via
// APP_DATABASE_URL. Every query is subject to Row-Level Security and only sees
// rows of the current lodge, which must be set per request via `withTenant`.
export const prisma =
  globalForPrisma.prisma ??
  new GeneratedPrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.APP_DATABASE_URL, ...poolTuning }),
  });

// Admin client: connects as the superuser (bypasses RLS) via DATABASE_URL. Use
// ONLY for legitimately cross-tenant / system operations that cannot carry a
// lodge context: login lookup, onboarding (tenant creation), Stripe webhooks.
export const prismaAdmin =
  globalForPrisma.prismaAdmin ??
  new GeneratedPrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ...poolTuning }),
  });

/**
 * Runs `cb` inside a transaction with the tenant context set, so RLS scopes
 * every query/mutation to `lodgeId`. The GUC is local to the transaction.
 * Forgetting to wrap a query fails closed (RLS sees no context → zero rows).
 */
export function withTenant<T>(
  lodgeId: string,
  cb: (db: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_lodge_id', ${lodgeId}, true)`;
    return cb(tx);
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaAdmin = prismaAdmin;
}
