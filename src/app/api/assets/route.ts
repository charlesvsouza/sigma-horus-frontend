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
    db.asset.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { chartAccount: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
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
  const name = String(body?.name ?? '').trim();
  const description = String(body?.description ?? '').trim();
  const category = String(body?.category ?? '').trim();
  const acquisitionDate = body?.acquisitionDate ? new Date(body.acquisitionDate) : null;
  const acquisitionValue = Number(body?.acquisitionValue ?? 0);
  const currentValue = body?.currentValue !== undefined && body.currentValue !== '' ? Number(body.currentValue) : null;
  const status = String(body?.status ?? 'active').trim();
  const chartAccountId = body?.chartAccountId ? String(body.chartAccountId) : null;
  const notes = String(body?.notes ?? '').trim();

  if (!name || Number.isNaN(acquisitionValue)) {
    return NextResponse.json({ error: 'Informe ao menos o nome e o valor de aquisição.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    let validChartId: string | null = null;
    if (chartAccountId) {
      const chart = await db.chartAccount.findFirst({ where: { id: chartAccountId, lodgeId: String(lodgeId) }, select: { id: true } });
      validChartId = chart?.id ?? null;
    }

    const created = await db.asset.create({
      data: {
        lodgeId: String(lodgeId),
        name,
        description: description || null,
        category: category || null,
        acquisitionDate,
        acquisitionValue,
        currentValue,
        status,
        chartAccountId: validChartId,
        notes: notes || null,
      },
      include: { chartAccount: { select: { id: true, code: true, name: true } } },
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'asset', entityId: created.id, metadata: { name, acquisitionValue } });
    return created;
  });

  return NextResponse.json({ item });
}
