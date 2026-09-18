import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { canUnlockSession, requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Destrancar é reforçado no servidor além do gate de escrita normal — só
// Administrador/Venerável, mesmo que o papel tenha members:write (Secretário
// não pode, por exemplo). Ver src/lib/rbac.ts:canUnlockSession.
export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!canUnlockSession(session?.user?.role)) {
    return NextResponse.json({ error: 'Só o Administrador ou o Venerável podem destrancar a sessão.' }, { status: 403 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.session.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { locked: true } });
    if (!existing) return null;
    const updated = await db.session.update({
      where: { id },
      data: { locked: false, lockedAt: null, lockedById: null },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'session', entityId: id, metadata: { action: 'unlock' } });
    return { item: updated };
  });

  if (!result) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
  return NextResponse.json({ item: result.item });
}
