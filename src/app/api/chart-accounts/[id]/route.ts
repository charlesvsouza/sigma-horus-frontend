import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

async function getSessionAndCheck(lodgeId: string | undefined, role: string | undefined) {
  if (!lodgeId) return { error: 'Unauthorized', status: 401 } as const;
  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return { error: access.error, status: access.status } as const;
  return { ok: true as const };
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const check = await getSessionAndCheck(lodgeId, role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;

  const result = await withTenant(String(lodgeId), async (db) => {
    const account = await db.chartAccount.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!account) return { notFound: true as const };
    await db.chartAccount.delete({ where: { id } });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session!.user.id,
      action: 'DELETE',
      entity: 'chart-account',
      entityId: id,
      metadata: { code: account.code, name: account.name },
    });
    return { ok: true as const };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const check = await getSessionAndCheck(lodgeId, role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const body = await request.json();
  const { code, name, type } = body;

  await withTenant(String(lodgeId), async (db) => {
    const data: Record<string, unknown> = {};
    if (code) data.code = code;
    if (name) data.name = name;
    if (type) data.type = type;
    await db.chartAccount.updateMany({ where: { id, lodgeId: String(lodgeId) }, data });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session!.user.id,
      action: 'UPDATE',
      entity: 'chart-account',
      entityId: id,
      metadata: { ...data },
    });
  });

  return NextResponse.json({ ok: true });
}
