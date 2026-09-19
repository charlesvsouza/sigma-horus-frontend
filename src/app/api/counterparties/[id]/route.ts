import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

const KINDS = ['client', 'supplier', 'both'];

async function getSessionAndCheck(lodgeId: string | undefined, role: string | undefined) {
  if (!lodgeId) return { error: 'Unauthorized', status: 401 } as const;
  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
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

  if (body?.kind != null && !KINDS.includes(String(body.kind))) {
    return NextResponse.json({ error: 'Tipo deve ser client, supplier ou both.' }, { status: 400 });
  }

  const fields = ['kind', 'name', 'legalName', 'document', 'isCompany', 'email', 'phone', 'addressLine', 'city', 'state', 'zipCode', 'category', 'notes', 'active'] as const;
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    if (body?.[f] === undefined) continue;
    data[f] = typeof body[f] === 'string' ? body[f].trim() || null : body[f];
  }

  try {
    const outcome = await withTenant(String(lodgeId), async (db) => {
      const existing = await db.counterparty.findFirst({ where: { id, lodgeId: String(lodgeId) } });
      if (!existing) return { notFound: true as const };
      await db.counterparty.updateMany({ where: { id, lodgeId: String(lodgeId) }, data });
      await logAudit(db, {
        lodgeId: String(lodgeId),
        userId: session!.user.id,
        action: 'UPDATE',
        entity: 'counterparty',
        entityId: id,
        metadata: data,
      });
      return { ok: true as const };
    });
    if ('notFound' in outcome) return NextResponse.json({ error: 'Contraparte não encontrada.' }, { status: 404 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe uma contraparte com esse documento nesta loja.' }, { status: 409 });
    }
    throw error;
  }

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
    const item = await db.counterparty.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!item) return { notFound: true as const };
    await db.counterparty.delete({ where: { id } });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session!.user.id,
      action: 'DELETE',
      entity: 'counterparty',
      entityId: id,
      metadata: { name: item.name },
    });
    return { ok: true as const };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Contraparte não encontrada.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
