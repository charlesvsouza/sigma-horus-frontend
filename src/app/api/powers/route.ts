import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const items = await withTenant(String(lodgeId), (db) =>
    db.power.findMany({
      where: { lodgeId: String(lodgeId) },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    }),
  );

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
    return NextResponse.json({ error: 'Nome da potência é obrigatório.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), (db) =>
    db.power.create({
      data: {
        lodgeId: String(lodgeId),
        name,
        order: Number.isFinite(order) ? order : 1,
      },
    }),
  );

  return NextResponse.json({ item });
}
