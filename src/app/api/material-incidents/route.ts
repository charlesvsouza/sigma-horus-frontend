import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { isIncidentKind, validateReport, INCIDENT_STATUSES } from '@/lib/inventory';
import { notifyReplacementRequest, quarantineByMaterial } from '@/lib/inventory-server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'inventory', 'read', session?.user?.memberId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const materialId = searchParams.get('materialId');

  const items = await withTenant(String(lodgeId), (db) =>
    db.materialIncident.findMany({
      where: {
        lodgeId: String(lodgeId),
        ...(status && (INCIDENT_STATUSES as readonly string[]).includes(status) ? { status } : {}),
        ...(materialId ? { materialId } : {}),
      },
      include: { material: { select: { id: true, name: true, category: true } } },
      orderBy: { reportedAt: 'desc' },
    }),
  );
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'inventory', 'write', session?.user?.memberId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const materialId = String(body?.materialId ?? '').trim();
  const kind = body?.kind;
  const quantity = Number(body?.quantity ?? 1);
  const requestReplacement = body?.requestReplacement === true;
  const notes = body?.notes ? String(body.notes).trim().slice(0, 1000) || null : null;

  if (!materialId || !isIncidentKind(kind)) {
    return NextResponse.json({ error: 'Informe o material e o tipo da ocorrência.' }, { status: 400 });
  }

  const reporterName = session.user.name ?? 'O Arquiteto';

  const result = await withTenant(String(lodgeId), async (db) => {
    const material = await db.material.findFirst({ where: { id: materialId, lodgeId: String(lodgeId) } });
    if (!material) return { notFound: true as const };

    const { total: quarantined } = await quarantineByMaterial(db, String(lodgeId), materialId);
    const check = validateReport({ quantity, materialQuantity: material.quantity, quarantined });
    if (!check.ok) return { invalid: check.error };

    const created = await db.materialIncident.create({
      data: {
        lodgeId: String(lodgeId),
        materialId,
        kind,
        quantity,
        requestReplacement,
        notes,
        reportedById: session.user.id,
        reportedByName: reporterName,
      },
      include: { material: { select: { id: true, name: true, category: true } } },
    });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'CREATE',
      entity: 'materialIncident',
      entityId: created.id,
      metadata: { materialId, kind, quantity, requestReplacement },
    });
    return { created, materialName: material.name };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Material não encontrado.' }, { status: 404 });
  if ('invalid' in result) return NextResponse.json({ error: result.invalid }, { status: 422 });

  if (requestReplacement) {
    await notifyReplacementRequest({
      lodgeId: String(lodgeId),
      materialName: result.materialName,
      kind,
      quantity,
      reporterName,
      notes,
    });
  }

  return NextResponse.json({ item: result.created });
}
