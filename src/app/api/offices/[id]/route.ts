import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const found = await withTenant(String(lodgeId), async (db) => {
    const prev = await db.office.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, name: true } });
    if (!prev) return false;
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'office', entityId: id, metadata: { name: prev.name } });
    await db.office.deleteMany({ where: { id, lodgeId: String(lodgeId) } });
    return true;
  });
  if (!found) return NextResponse.json({ error: 'Cargo não encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
