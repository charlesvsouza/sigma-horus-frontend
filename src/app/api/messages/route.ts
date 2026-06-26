import { auth } from '@/lib/auth';
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

  const access = await requireLodgeAccess(String(lodgeId), role, 'messages', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const items = await withTenant(String(lodgeId), (db) =>
    db.messageLog.findMany({
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
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'messages', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json();
  const title = String(body?.title ?? '').trim();
  const channel = String(body?.channel ?? 'email');
  const content = String(body?.content ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;

  if (!title || !content) {
    return NextResponse.json({ error: 'Título e conteúdo são obrigatórios.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) =>
    db.messageLog.create({
      data: {
        lodgeId: String(lodgeId),
        memberId,
        channel,
        title,
        content,
      },
      include: { member: { select: { id: true, name: true } } },
    }),
  );

  return NextResponse.json({ item });
}
