import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const items = await withTenant(String(lodgeId), (db) =>
    db.member.findMany({
      where: { lodgeId: String(lodgeId) },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        gradeName: true,
        rite: { select: { id: true, name: true } },
        power: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
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
  const email = String(body?.email ?? '').trim();
  const phone = String(body?.phone ?? '').trim();
  const status = String(body?.status ?? 'active');
  const riteId = body?.riteId ? String(body.riteId) : null;
  const powerId = body?.powerId ? String(body.powerId) : null;
  const gradeName = body?.gradeName ? String(body.gradeName) : null;

  if (!name) {
    return NextResponse.json({ error: 'Nome do membro é obrigatório.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    const created = await db.member.create({
      data: {
        lodgeId: String(lodgeId),
        name,
        email: email || null,
        phone: phone || null,
        status,
        riteId,
        powerId,
        gradeName,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        gradeName: true,
        rite: { select: { id: true, name: true } },
        power: { select: { id: true, name: true } },
      },
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'member', entityId: created.id, metadata: { name } });
    return created;
  });

  return NextResponse.json({ item });
}
