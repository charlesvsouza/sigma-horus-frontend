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

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json();

  const item = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.asset.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return null;

    let chartAccountId = existing.chartAccountId;
    if (body?.chartAccountId !== undefined) {
      chartAccountId = body.chartAccountId ? String(body.chartAccountId) : null;
      if (chartAccountId) {
        const chart = await db.chartAccount.findFirst({ where: { id: chartAccountId, lodgeId: String(lodgeId) }, select: { id: true } });
        chartAccountId = chart?.id ?? null;
      }
    }

    const updated = await db.asset.update({
      where: { id },
      data: {
        name: body?.name !== undefined ? String(body.name).trim() : undefined,
        description: body?.description !== undefined ? (String(body.description).trim() || null) : undefined,
        category: body?.category !== undefined ? (String(body.category).trim() || null) : undefined,
        acquisitionDate: body?.acquisitionDate !== undefined ? (body.acquisitionDate ? new Date(body.acquisitionDate) : null) : undefined,
        acquisitionValue: body?.acquisitionValue !== undefined ? Number(body.acquisitionValue) : undefined,
        currentValue: body?.currentValue !== undefined ? (body.currentValue === '' ? null : Number(body.currentValue)) : undefined,
        status: body?.status !== undefined ? String(body.status).trim() : undefined,
        notes: body?.notes !== undefined ? (String(body.notes).trim() || null) : undefined,
        chartAccountId: body?.chartAccountId !== undefined ? chartAccountId : undefined,
      },
      include: { chartAccount: { select: { id: true, code: true, name: true } } },
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'asset', entityId: id, metadata: { fields: Object.keys(body ?? {}) } });
    return updated;
  });

  if (!item) return NextResponse.json({ error: 'Bem não encontrado.' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;

  await withTenant(String(lodgeId), async (db) => {
    const prev = await db.asset.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, name: true } });
    if (prev) {
      await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'asset', entityId: id, metadata: { name: prev.name } });
    }
    await db.asset.deleteMany({ where: { id, lodgeId: String(lodgeId) } });
  });

  return NextResponse.json({ success: true });
}
