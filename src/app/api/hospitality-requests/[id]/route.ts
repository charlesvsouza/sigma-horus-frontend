import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'campaigns', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body?.status === 'reviewed' ? 'reviewed' : 'pending';

  const result = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.hospitalityRequest.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return { notFound: true as const };
    await db.hospitalityRequest.update({ where: { id }, data: { status } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'hospitality-request', entityId: id, metadata: { status } });
    return { ok: true as const };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
