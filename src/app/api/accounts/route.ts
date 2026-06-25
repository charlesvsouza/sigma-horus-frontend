import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.account.findMany({
    where: { lodgeId: String(lodgeId) },
    include: {
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
  const title = String(body?.title ?? '').trim();
  const type = String(body?.type ?? 'RECEIVABLE').trim().toUpperCase();
  const amount = Number(body?.amount ?? 0);
  const dueDate = body?.dueDate ? new Date(body.dueDate) : new Date();
  const status = String(body?.status ?? 'pending').trim();
  const description = String(body?.description ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;

  if (!title || !['RECEIVABLE', 'PAYABLE'].includes(type) || Number.isNaN(amount)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const item = await prisma.account.create({
    data: {
      lodgeId: String(lodgeId),
      title,
      type,
      amount,
      dueDate,
      status,
      description: description || null,
      memberId,
    },
    include: {
      member: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ item });
}
