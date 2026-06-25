import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.rite.findMany({
    where: { lodgeId: String(lodgeId) },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
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
  const name = String(body?.name ?? '').trim();
  const order = Number(body?.order ?? 1);

  if (!name) {
    return NextResponse.json({ error: 'Nome do rito é obrigatório.' }, { status: 400 });
  }

  const item = await prisma.rite.create({
    data: {
      lodgeId: String(lodgeId),
      name,
      order: Number.isFinite(order) ? order : 1,
    },
  });

  return NextResponse.json({ item });
}
