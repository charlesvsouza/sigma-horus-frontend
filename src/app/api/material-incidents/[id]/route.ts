import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { isResolution, planResolution } from '@/lib/inventory';
import { NextResponse } from 'next/server';

// Decisão sobre a ocorrência (baixa / reposição / dispensa) altera o CADASTRO
// (Material.quantity), então exige materials:write — o Arquiteto só relata
// (inventory:write) e não decide.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'materials', 'write', session?.user?.memberId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const resolution = body?.resolution;
  const resolutionNotes = body?.notes ? String(body.notes).trim().slice(0, 1000) || null : null;
  if (!isResolution(resolution)) {
    return NextResponse.json({ error: 'Resolução deve ser write_off, replace ou dismiss.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const incident = await db.materialIncident.findFirst({ where: { id, lodgeId: String(lodgeId) }, include: { material: true } });
    if (!incident) return { notFound: true as const };

    const plan = planResolution(incident, incident.material.quantity, resolution);
    if (!plan.ok) return { conflict: plan.error };

    if (plan.quantityDelta !== 0) {
      await db.material.update({ where: { id: incident.materialId }, data: { quantity: { increment: plan.quantityDelta } } });
    }
    const updated = await db.materialIncident.update({
      where: { id },
      data: {
        status: plan.status,
        resolvedById: session.user.id,
        resolvedByName: session.user.name ?? null,
        resolvedAt: new Date(),
        resolutionNotes,
      },
      include: { material: { select: { id: true, name: true, category: true } } },
    });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'materialIncident',
      entityId: id,
      metadata: { resolution, status: plan.status, quantityDelta: plan.quantityDelta },
    });
    return { updated };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Ocorrência não encontrada.' }, { status: 404 });
  if ('conflict' in result) return NextResponse.json({ error: result.conflict }, { status: 409 });
  return NextResponse.json({ item: result.updated });
}
