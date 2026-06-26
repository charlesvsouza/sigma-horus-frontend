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
    db.payment.findMany({
      where: { lodgeId: String(lodgeId) },
      include: {
        account: { select: { id: true, title: true, type: true } },
        member: { select: { id: true, name: true } },
      },
      orderBy: { paidAt: 'desc' },
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
  const accountId = String(body?.accountId ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;
  const amount = Number(body?.amount ?? 0);
  const paidAt = body?.paidAt ? new Date(body.paidAt) : new Date();
  const method = String(body?.method ?? 'manual').trim();
  const note = String(body?.note ?? '').trim();

  if (!accountId || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const account = await db.account.findFirst({
      where: { id: accountId, lodgeId: String(lodgeId) },
    });

    if (!account) {
      return { notFound: true as const };
    }

    const created = await db.payment.create({
      data: {
        lodgeId: String(lodgeId),
        accountId,
        memberId,
        amount,
        paidAt,
        method: method || 'manual',
        note: note || null,
      },
      include: {
        account: { select: { id: true, title: true, type: true } },
        member: { select: { id: true, name: true } },
      },
    });

    const aggregate = await db.payment.aggregate({
      _sum: { amount: true },
      where: { accountId },
    });

    const totalPaid = Number(aggregate._sum.amount ?? 0);
    const nextStatus = totalPaid >= Number(account.amount) ? 'paid' : 'pending';

    await db.account.update({
      where: { id: accountId },
      data: { status: nextStatus },
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'payment', entityId: created.id, metadata: { accountId, amount, method } });
    return { payment: created };
  });

  if ('notFound' in result) {
    return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
  }

  return NextResponse.json({ item: result.payment });
}
