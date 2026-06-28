import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'campaigns', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const item = await withTenant(String(lodgeId), (db) =>
    db.campaign.findFirst({
      where: { id, lodgeId: String(lodgeId) },
      include: { donations: { orderBy: { receivedAt: 'desc' } } },
    }),
  );
  if (!item) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });

  const raised = item.donations.reduce((s, d) => s + Number(d.amount), 0);
  return NextResponse.json({ item: { ...item, raised, totalApplied: raised + Number(item.fundAllocated) } });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'campaigns', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const status = ['active', 'completed', 'canceled'].includes(body?.status) ? body.status : undefined;
  if (!status) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });

  const item = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.campaign.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true } });
    if (!existing) return null;
    const updated = await db.campaign.update({ where: { id }, data: { status } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'campaign', entityId: id, metadata: { status } });
    return updated;
  });
  if (!item) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });
  return NextResponse.json({ item });
}
