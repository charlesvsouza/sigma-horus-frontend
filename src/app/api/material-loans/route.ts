import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { isEligibleForDegree, symbolicSituation } from '@/lib/masonic-degree';
import { availableUnits } from '@/lib/inventory';
import { quarantineByMaterial } from '@/lib/inventory-server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'inventory', 'read', session?.user?.memberId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');
  const materialId = searchParams.get('materialId');
  const status = searchParams.get('status');

  const items = await withTenant(String(lodgeId), (db) =>
    db.materialLoan.findMany({
      where: {
        lodgeId: String(lodgeId),
        ...(memberId ? { memberId } : {}),
        ...(materialId ? { materialId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        material: { select: { id: true, name: true, category: true, requiredDegree: true } },
        member: { select: { id: true, name: true } },
      },
      orderBy: { issuedAt: 'desc' },
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'inventory', 'write', session?.user?.memberId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const materialId = String(body?.materialId ?? '').trim();
  const memberId = String(body?.memberId ?? '').trim();
  const quantity = Number(body?.quantity ?? 1);
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (!materialId || !memberId || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const material = await db.material.findFirst({ where: { id: materialId, lodgeId: String(lodgeId), active: true } });
    if (!material) return { notFoundMaterial: true as const };

    const member = await db.member.findFirst({
      where: { id: memberId, lodgeId: String(lodgeId) },
      select: { id: true, name: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true },
    });
    if (!member) return { notFoundMember: true as const };

    if (material.requiredDegree) {
      const situation = symbolicSituation(member);
      if (!isEligibleForDegree(situation, material.requiredDegree)) {
        return { ineligible: true as const, requiredDegree: material.requiredDegree };
      }
    }

    const issued = await db.materialLoan.aggregate({
      _sum: { quantity: true },
      where: { materialId, status: 'issued' },
    });
    const { total: quarantined } = await quarantineByMaterial(db, String(lodgeId), materialId);
    const available = availableUnits({ quantity: material.quantity, issued: Number(issued._sum.quantity ?? 0), quarantined });
    if (quantity > available) return { unavailable: true as const, available };

    const created = await db.materialLoan.create({
      data: {
        lodgeId: String(lodgeId),
        materialId,
        memberId,
        quantity,
        notes,
        createdById: session.user.id,
      },
      include: {
        material: { select: { id: true, name: true, category: true, requiredDegree: true } },
        member: { select: { id: true, name: true } },
      },
    });

    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'CREATE',
      entity: 'materialLoan',
      entityId: created.id,
      metadata: { materialId, memberId, quantity },
    });

    return { created };
  });

  if ('notFoundMaterial' in result) return NextResponse.json({ error: 'Material não encontrado ou inativo.' }, { status: 404 });
  if ('notFoundMember' in result) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
  if ('ineligible' in result) {
    return NextResponse.json({ error: `Este membro ainda não atingiu o grau exigido para este material (${result.requiredDegree}).` }, { status: 422 });
  }
  if ('unavailable' in result) {
    return NextResponse.json({ error: `Quantidade indisponível em estoque (disponível: ${result.available}).` }, { status: 409 });
  }

  return NextResponse.json({ item: result.created });
}
