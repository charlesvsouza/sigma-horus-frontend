import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parseBRDateTimeLocal } from '@/lib/br-time';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.session.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { _count: { select: { attendances: { where: { status: 'present' } } } } },
      orderBy: { date: 'desc' },
    }),
  );
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const title = String(body?.title ?? '').trim();
  const date = body?.date ? parseBRDateTimeLocal(String(body.date)) : new Date();
  const endDate = body?.endDate ? parseBRDateTimeLocal(String(body.endDate)) : null;
  const type = String(body?.type ?? 'ordinary');
  const grade = body?.grade ? String(body.grade) : null;
  const notes = body?.notes ? String(body.notes) : null;
  const agenda = body?.agenda ? String(body.agenda) : null;

  if (!title) return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 });
  if (endDate && endDate <= date) {
    return NextResponse.json({ error: 'O término precisa ser depois do início da sessão.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    const created = await db.session.create({
      data: { lodgeId: String(lodgeId), title, date, endDate, type, grade, notes, agenda },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'session', entityId: created.id, metadata: { title, type } });
    return created;
  });
  return NextResponse.json({ item });
}
