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
    db.document.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { member: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
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
  const title = String(body?.title ?? '').trim();
  const kind = String(body?.kind ?? 'document');
  const content = String(body?.content ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;

  if (!title) {
    return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) =>
    db.document.create({
      data: {
        lodgeId: String(lodgeId),
        memberId: memberId ?? '',
        title,
        kind,
        content: content || null,
      },
      include: { member: { select: { id: true, name: true } } },
    }),
  );

  return NextResponse.json({ item });
}
