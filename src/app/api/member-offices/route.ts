import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ items: [] });
  const items = await withTenant(String(lodgeId), (db) =>
    db.memberOffice.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { member: { select: { id: true, name: true } }, office: { select: { id: true, name: true } }, term: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  );
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const memberId = String(body?.memberId ?? '');
  const officeId = String(body?.officeId ?? '');
  const termId = String(body?.termId ?? '');
  if (!memberId || !officeId || !termId) {
    return NextResponse.json({ error: 'memberId, officeId e termId são obrigatórios.' }, { status: 400 });
  }
  const item = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.memberOffice.findUnique({ where: { memberId_officeId_termId: { memberId, officeId, termId } } });
    if (existing) return existing;
    const created = await db.memberOffice.create({ data: { lodgeId: String(lodgeId), memberId, officeId, termId } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'memberOffice', entityId: created.id, metadata: { memberId, officeId, termId } });
    return created;
  });
  return NextResponse.json({ item });
}
