import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { MEMBER_LIST_INCLUDE, parseMemberFields, parseRelatives } from '@/lib/member-fields';
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

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const items = await withTenant(String(lodgeId), (db) =>
    db.member.findMany({
      where: { lodgeId: String(lodgeId) },
      include: MEMBER_LIST_INCLUDE,
      orderBy: { name: 'asc' },
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

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json();
  const fields = parseMemberFields(body);
  const relatives = parseRelatives(body);

  if (!fields.name) {
    return NextResponse.json({ error: 'Nome do membro é obrigatório.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    const created = await db.member.create({
      data: {
        lodgeId: String(lodgeId),
        ...fields,
        relatives: { create: relatives.map((r) => ({ lodgeId: String(lodgeId), ...r })) },
      },
      include: MEMBER_LIST_INCLUDE,
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'member', entityId: created.id, metadata: { name: fields.name } });
    return created;
  });

  return NextResponse.json({ item });
}
