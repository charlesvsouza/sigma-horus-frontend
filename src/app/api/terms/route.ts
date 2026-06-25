import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });
  const items = await withTenant(String(lodgeId), (db) =>
    db.term.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { _count: { select: { memberOffices: true } } },
      orderBy: { startDate: 'desc' },
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
  const startDate = body?.startDate ? new Date(body.startDate) : new Date();
  const endDate = body?.endDate ? new Date(body.endDate) : null;
  const notes = body?.notes ? String(body.notes) : null;
  if (!title) return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 });
  const item = await withTenant(String(lodgeId), async (db) => {
    const created = await db.term.create({ data: { lodgeId: String(lodgeId), title, startDate, endDate, notes } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'term', entityId: created.id, metadata: { title } });
    return created;
  });
  return NextResponse.json({ item });
}
