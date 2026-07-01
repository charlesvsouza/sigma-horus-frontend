import type { Prisma } from '@/generated/prisma/client';

type Action = 'CREATE' | 'UPDATE' | 'DELETE';

// Receives the tenant transaction client (`db` from `withTenant`) so the
// AuditLog insert runs under the same lodge context and satisfies RLS.
export async function logAudit(
  db: Prisma.TransactionClient,
  params: {
    lodgeId: string;
    userId: string;
    action: Action;
    entity: string;
    entityId: string;
    /** Estado anterior (opcional) — snapshot antes da alteração. */
    before?: Record<string, unknown>;
    /** Estado posterior (opcional) — snapshot depois da alteração. */
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await db.auditLog.create({
      data: {
        lodgeId: params.lodgeId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before ? JSON.stringify(params.before) : null,
        after: JSON.stringify(params.metadata ?? {}),
      },
    });
  } catch {
    // swallow — audit failure should never block the main operation
  }
}
