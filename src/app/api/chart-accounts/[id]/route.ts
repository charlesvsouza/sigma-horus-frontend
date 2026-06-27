import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;

  const result = await withTenant(String(lodgeId), async (db) => {
    const account = await db.chartAccount.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!account) return { notFound: true as const };
    await db.chartAccount.delete({ where: { id } });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
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
