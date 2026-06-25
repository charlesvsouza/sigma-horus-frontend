import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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
    },
    include: {
      account: { select: { id: true, title: true } },
      member: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ item });
}
