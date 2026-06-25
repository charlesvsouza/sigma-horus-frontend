import { PrismaClient as GeneratedPrismaClient, Prisma } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type PrismaClient = InstanceType<typeof GeneratedPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaAdmin?: PrismaClient;
};

// Tenant client: connects as the NOBYPASSRLS role (`sigma_app`) via
// APP_DATABASE_URL. Every query is subject to Row-Level Security and only sees
// rows of the current lodge, which must be set per request via `withTenant`.
export const prisma =
  globalForPrisma.prisma ??
  new GeneratedPrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.APP_DATABASE_URL }),
  });

// Admin client: connects as the superuser (bypasses RLS) via DATABASE_URL. Use
// ONLY for legitimately cross-tenant / system operations that cannot carry a
// lodge context: login lookup, onboarding (tenant creation), Stripe webhooks.
export const prismaAdmin =
  globalForPrisma.prismaAdmin ??
  new GeneratedPrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
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
