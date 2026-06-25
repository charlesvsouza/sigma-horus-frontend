import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.payment.findMany({
    where: { lodgeId: String(lodgeId) },
    include: {
      account: { select: { id: true, title: true, type: true } },
      member: { select: { id: true, name: true } },
    },
    orderBy: { paidAt: 'desc' },
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const account = await prisma.account.findFirst({
    where: { id: accountId, lodgeId: String(lodgeId) },
  });

  if (!account) {
    return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
  }

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
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

    const aggregate = await tx.payment.aggregate({
      _sum: { amount: true },
      where: { accountId },
    });

    const totalPaid = Number(aggregate._sum.amount ?? 0);
    const nextStatus = totalPaid >= Number(account.amount) ? 'paid' : 'pending';

    await tx.account.update({
      where: { id: accountId },
      data: { status: nextStatus },
    });

    return created;
  });

  return NextResponse.json({ item: payment });
}
