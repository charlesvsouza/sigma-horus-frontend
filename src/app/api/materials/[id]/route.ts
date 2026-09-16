import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

async function getSessionAndCheck(lodgeId: string | undefined, role: string | undefined) {
  if (!lodgeId) return { error: 'Unauthorized', status: 401 } as const;
  const access = await requireLodgeAccess(String(lodgeId), role, 'materials', 'write');
  if (!access.ok) return { error: access.error, status: access.status } as const;
  return { ok: true as const };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const check = await getSessionAndCheck(lodgeId, role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const body = await request.json();

  const result = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.material.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return { notFound: true as const };

    let riteId = existing.riteId;
    if (body?.riteId !== undefined) {
      riteId = body.riteId ? String(body.riteId) : null;
      if (riteId) {
        const rite = await db.rite.findFirst({ where: { id: riteId, lodgeId: String(lodgeId) }, select: { id: true } });
        riteId = rite?.id ?? null;
      }
    }

    const fields = ['name', 'category', 'requiredDegree', 'notes', 'active'] as const;
    const data: Record<string, unknown> = { riteId: body?.riteId !== undefined ? riteId : undefined };
    for (const f of fields) {
      if (body?.[f] === undefined) continue;
      data[f] = typeof body[f] === 'string' ? body[f].trim() || null : body[f];
    }
    if (body?.quantity !== undefined) {
      const q = Number(body.quantity);
      if (!Number.isFinite(q) || q < 0) return { invalidQuantity: true as const };
      data.quantity = q;
    }

    await db.material.updateMany({ where: { id, lodgeId: String(lodgeId) }, data });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session!.user.id,
      action: 'UPDATE',
      entity: 'material',
      entityId: id,
      metadata: data,
    });
    return { ok: true as const };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Material não encontrado.' }, { status: 404 });
  if ('invalidQuantity' in result) return NextResponse.json({ error: 'Quantidade inválida.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const check = await getSessionAndCheck(lodgeId, role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;

  const result = await withTenant(String(lodgeId), async (db) => {
    const item = await db.material.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!item) return { notFound: true as const };

    const loanCount = await db.materialLoan.count({ where: { materialId: id } });
    if (loanCount > 0) return { inUse: true as const };

    await db.material.delete({ where: { id } });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session!.user.id,
      action: 'DELETE',
      entity: 'material',
      entityId: id,
      metadata: { name: item.name },
    });
    return { ok: true as const };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Material não encontrado.' }, { status: 404 });
  if ('inUse' in result) {
    return NextResponse.json({ error: 'Este material possui histórico de fornecimento e não pode ser excluído. Marque como inativo em vez de excluir.' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
