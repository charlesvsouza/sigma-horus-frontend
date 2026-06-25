import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

function addInterval(date: Date, interval: string) {
  const nextDate = new Date(date);

  switch (interval) {
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate;
}

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.invoice.findMany({
    where: { lodgeId: String(lodgeId) },
    include: {
      account: { select: { id: true, title: true } },
      member: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: 'asc' },
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
  const number = String(body?.number ?? '').trim();
  const amount = Number(body?.amount ?? 0);
  const dueDate = body?.dueDate ? new Date(body.dueDate) : new Date();
  const description = String(body?.description ?? '').trim();
  const isRecurring = Boolean(body?.isRecurring);
  const recurringInterval = typeof body?.recurringInterval === 'string' ? body.recurringInterval : 'monthly';
  const recurringCount = body?.recurringCount != null && body.recurringCount !== '' ? Number(body.recurringCount) : null;

  if (!accountId || !number || Number.isNaN(amount)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const item = await prisma.invoice.create({
    data: {
      lodgeId: String(lodgeId),
      accountId,
      memberId,
      number,
      amount,
      dueDate,
      description: description || null,
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : null,
      recurringCount: isRecurring ? recurringCount : null,
      nextDueDate: isRecurring ? addInterval(dueDate, recurringInterval) : null,
    },
    include: {
      account: { select: { id: true, title: true } },
      member: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ item });
}
