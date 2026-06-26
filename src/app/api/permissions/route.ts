import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import {
  ACTIONS,
  RESOURCES,
  ROLES,
  getEffectiveMatrix,
  invalidateLodgePolicy,
  normalizeRole,
  type Action,
  type Resource,
} from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Apenas o admin da loja gerencia a matriz de permissões.
function isAdmin(role?: string | null) {
  return normalizeRole(role) === 'admin';
}

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const { matrix, customized } = await getEffectiveMatrix(String(lodgeId));
  return NextResponse.json({ matrix, customized, roles: ROLES, resources: RESOURCES, actions: ACTIONS });
}

export async function PUT(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const body = await request.json();
  const incoming = body?.matrix as
    | Record<string, Record<string, Record<string, boolean>>>
    | undefined;
  if (!incoming || typeof incoming !== 'object') {
    return NextResponse.json({ error: 'Matriz inválida.' }, { status: 400 });
  }

  await withTenant(String(lodgeId), async (db) => {
    for (const r of ROLES) {
      for (const resource of RESOURCES) {
        for (const action of ACTIONS) {
          const allowed = Boolean(incoming?.[r]?.[resource]?.[action]);
          await db.rolePermission.upsert({
            where: {
              lodgeId_role_resource_action: {
                lodgeId: String(lodgeId),
                role: r,
                resource: resource as Resource,
                action: action as Action,
              },
            },
            update: { allowed },
            create: {
              lodgeId: String(lodgeId),
              role: r,
              resource: resource as Resource,
              action: action as Action,
              allowed,
            },
          });
        }
      }
    }

    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'rolePermission',
      entityId: String(lodgeId),
      metadata: { scope: 'matrix' },
    });
  });

  invalidateLodgePolicy(String(lodgeId));

  const { matrix } = await getEffectiveMatrix(String(lodgeId));
  return NextResponse.json({ matrix, customized: true });
}
