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

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.chartAccount.findMany({
      where: { lodgeId: String(lodgeId) },
      orderBy: { code: 'asc' },
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const { code, name, type } = body;

  if (!code || !name || !type) {
    return NextResponse.json({ error: 'Código, nome e tipo são obrigatórios.' }, { status: 400 });
  }

  if (!['REVENUE', 'EXPENSE'].includes(type)) {
    return NextResponse.json({ error: 'Tipo deve ser REVENUE ou EXPENSE.' }, { status: 400 });
  }

  const account = await withTenant(String(lodgeId), async (db) => {
    const created = await db.chartAccount.create({
      data: { lodgeId: String(lodgeId), code, name, type },
    });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session!.user.id,
      action: 'CREATE',
      entity: 'chart-account',
      entityId: created.id,
      metadata: { code, name, type },
    });
    return created;
  });

  return NextResponse.json({ item: account });
}
