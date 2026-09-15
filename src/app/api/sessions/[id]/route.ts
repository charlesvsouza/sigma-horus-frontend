import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const readAccess = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'read');
  if (!readAccess.ok) return NextResponse.json({ error: readAccess.error }, { status: readAccess.status });

  const { id } = await params;
  const item = await withTenant(String(lodgeId), (db) =>
    db.session.findFirst({
      where: { id, lodgeId: String(lodgeId) },
      include: {
        attendances: {
          include: { member: { select: { id: true, name: true } } },
        },
      },
    }),
  );
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body?.title !== undefined) data.title = String(body.title).trim();
  if (body?.date !== undefined) data.date = new Date(body.date);
  if (body?.type !== undefined) data.type = String(body.type);
  if (body?.grade !== undefined) data.grade = body.grade ? String(body.grade) : null;
  if (body?.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body?.agenda !== undefined) data.agenda = body.agenda ? String(body.agenda) : null;
  if (body?.minutes !== undefined) data.minutes = body.minutes ? String(body.minutes) : null;

  const result = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.session.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return { notFound: true as const };
    const updated = await db.session.update({ where: { id }, data });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'session', entityId: id, metadata: { fields: Object.keys(data) } });
    return { item: updated };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
  return NextResponse.json({ item: result.item });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  await withTenant(String(lodgeId), (db) =>
    db.session.deleteMany({ where: { id, lodgeId: String(lodgeId) } }),
  );
  return NextResponse.json({ ok: true });
}
