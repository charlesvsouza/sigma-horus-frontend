import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });

  const items = await withTenant(String(lodgeId), (db) =>
    db.session.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { _count: { select: { attendances: true } } },
      orderBy: { date: 'desc' },
    }),
  );
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const title = String(body?.title ?? '').trim();
  const date = body?.date ? new Date(body.date) : new Date();
  const type = String(body?.type ?? 'ordinary');
  const grade = body?.grade ? String(body.grade) : null;
  const notes = body?.notes ? String(body.notes) : null;

  if (!title) return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 });

  const item = await withTenant(String(lodgeId), async (db) => {
    const created = await db.session.create({
      data: { lodgeId: String(lodgeId), title, date, type, grade, notes },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'session', entityId: created.id, metadata: { title, type } });
    return created;
  });
  return NextResponse.json({ item });
}
