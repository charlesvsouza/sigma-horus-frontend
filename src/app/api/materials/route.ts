import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'materials', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const materials = await withTenant(String(lodgeId), (db) =>
    db.material.findMany({
      where: { lodgeId: String(lodgeId) },
      include: {
        rite: { select: { id: true, name: true } },
        loans: { where: { status: 'issued' }, select: { quantity: true } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
  );

  const items = materials.map((m) => {
    const issued = m.loans.reduce((sum, l) => sum + l.quantity, 0);
    const { loans, ...rest } = m;
    return { ...rest, availableQuantity: m.quantity - issued };
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'materials', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const name = String(body?.name ?? '').trim();
  const quantity = Number(body?.quantity ?? 1);

  if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity < 0) {
    return NextResponse.json({ error: 'Quantidade inválida.' }, { status: 400 });
  }

  const requiredDegree = body?.requiredDegree ? String(body.requiredDegree).trim() : null;
  const riteId = body?.riteId ? String(body.riteId) : null;

  try {
    const created = await withTenant(String(lodgeId), async (db) => {
      let validRiteId: string | null = null;
      if (riteId) {
        const rite = await db.rite.findFirst({ where: { id: riteId, lodgeId: String(lodgeId) }, select: { id: true } });
        validRiteId = rite?.id ?? null;
      }

      const item = await db.material.create({
        data: {
          lodgeId: String(lodgeId),
          name,
          category: body?.category ? String(body.category).trim() : null,
          requiredDegree,
          quantity,
          riteId: validRiteId,
          notes: body?.notes ? String(body.notes).trim() : null,
        },
      });
      await logAudit(db, {
        lodgeId: String(lodgeId),
        userId: session!.user.id,
        action: 'CREATE',
        entity: 'material',
        entityId: item.id,
        metadata: { name, quantity },
      });
      return item;
    });

    return NextResponse.json({ item: created });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um material com esse nome nesta loja.' }, { status: 409 });
    }
    throw error;
  }
}
