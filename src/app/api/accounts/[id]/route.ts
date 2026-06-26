import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;

  await withTenant(String(lodgeId), async (db) => {
    const prev = await db.account.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, title: true } });
    if (prev) {
      await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'account', entityId: id, metadata: { title: prev.title } });
    }
    await db.account.deleteMany({ where: { id, lodgeId: String(lodgeId) } });
  });

  return NextResponse.json({ success: true });
}
