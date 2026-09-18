import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Trancar é permitido a quem já pode editar a sessão (mesmo gate de sempre) —
// a restrição fica só em DESTRANCAR (ver ./../unlock/route.ts).
export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const result = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.session.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { locked: true } });
    if (!existing) return null;
    if (existing.locked) return { alreadyLocked: true as const };
    const updated = await db.session.update({
      where: { id },
      data: { locked: true, lockedAt: new Date(), lockedById: session.user.id },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'session', entityId: id, metadata: { action: 'lock' } });
    return { item: updated };
  });

  if (!result) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
  if ('alreadyLocked' in result) return NextResponse.json({ ok: true });
  return NextResponse.json({ item: result.item });
}
