import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { createChargesWithAccounts } from '@/lib/charges';
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
    db.invoice.findMany({
      where: { lodgeId: String(lodgeId) },
      include: {
        account: { select: { id: true, title: true } },
        member: { select: { id: true, name: true } },
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
  const memberId = String(body?.memberId ?? '').trim();
  const dueDate = body?.dueDate ? new Date(body.dueDate) : new Date();
  const recurringCount = body?.recurringCount != null && body.recurringCount !== '' ? Number(body.recurringCount) : null;

  if (!memberId) {
    return NextResponse.json({ error: 'Selecione o membro a ser cobrado.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const member = await db.member.findFirst({ where: { id: memberId, lodgeId: String(lodgeId) }, select: { id: true } });
    if (!member) return { ok: false, status: 400, error: 'Membro inválido.' } as const;

    const created = await createChargesWithAccounts(db, {
      lodgeId: String(lodgeId),
      chartAccountId: String(body?.chartAccountId ?? '').trim(),
      memberIds: [member.id],
      amount: Number(body?.amount ?? 0),
      dueDate,
      description: String(body?.description ?? ''),
      number: String(body?.number ?? ''),
      isRecurring: Boolean(body?.isRecurring),
      recurringInterval: typeof body?.recurringInterval === 'string' ? body.recurringInterval : 'monthly',
      recurringCount,
    });
    if (!created.ok) return created;

    const item = await db.invoice.findUniqueOrThrow({
      where: { id: created.invoiceIds[0] },
      include: {
        account: { select: { id: true, title: true } },
        member: { select: { id: true, name: true } },
      },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'invoice', entityId: item.id, metadata: { number: item.number, amount: item.amount, accountId: item.accountId, chartAccountId: body?.chartAccountId } });
    return { ok: true, item } as const;
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ item: result.item });
}
