import type { Prisma } from '@/generated/prisma/client';
import { getToken } from 'next-auth/jwt';
import { headers } from 'next/headers';

type Action = 'CREATE' | 'UPDATE' | 'DELETE';

// Detecta se a sessão atual é de um dono-da-plataforma logado como este
// usuário (via /plataforma/entrar) e marca isso automaticamente em todo
// AuditLog — sem precisar tocar em cada uma das dezenas de chamadas de
// logAudit espalhadas pelas rotas. Lê o JWT direto (next-auth/jwt), não
// `@/lib/auth`, pra não criar import circular (auth.ts já importa logAudit).
async function isViaSuperadmin(): Promise<boolean> {
  try {
    const h = await headers();
    const token = await getToken({
      req: { headers: h },
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    });
    return Boolean(token?.viaSuperadmin);
  } catch {
    return false;
  }
}

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
    const viaSuperadmin = await isViaSuperadmin();
    await db.auditLog.create({
      data: {
        lodgeId: params.lodgeId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before ? JSON.stringify(params.before) : null,
        after: JSON.stringify(viaSuperadmin ? { ...params.metadata, viaSuperadmin: true } : (params.metadata ?? {})),
      },
    });
  } catch {
    // swallow — audit failure should never block the main operation
  }
}
