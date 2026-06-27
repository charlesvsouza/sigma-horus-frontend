import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const items = await withTenant(String(lodgeId), (db) =>
    db.account.findMany({
      where: { lodgeId: String(lodgeId) },
      include: {
        member: { select: { id: true, name: true } },
        chartAccount: { select: { id: true, code: true, name: true, category: true } },
      },
      orderBy: { dueDate: 'asc' },
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json();
  const title = String(body?.title ?? '').trim();
  const type = String(body?.type ?? 'RECEIVABLE').trim().toUpperCase();
  const amount = Number(body?.amount ?? 0);
  const dueDate = body?.dueDate ? new Date(body.dueDate) : new Date();
  const status = String(body?.status ?? 'pending').trim();
  const description = String(body?.description ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;
  const chartAccountId = body?.chartAccountId ? String(body.chartAccountId) : null;

  if (!title || !['RECEIVABLE', 'PAYABLE'].includes(type) || Number.isNaN(amount)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    // Garante que o plano de contas informado pertence à loja.
    let validChartId: string | null = null;
    if (chartAccountId) {
      const chart = await db.chartAccount.findFirst({ where: { id: chartAccountId, lodgeId: String(lodgeId) }, select: { id: true } });
      validChartId = chart?.id ?? null;
    }
    const created = await db.account.create({
      data: {
        lodgeId: String(lodgeId),
        title,
        type,
        amount,
        dueDate,
        status,
        description: description || null,
        memberId,
        chartAccountId: validChartId,
      },
      include: {
        member: { select: { id: true, name: true } },
        chartAccount: { select: { id: true, code: true, name: true, category: true } },
      },
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'account', entityId: created.id, metadata: { title, type, amount } });
    return created;
  });

  return NextResponse.json({ item });
}
