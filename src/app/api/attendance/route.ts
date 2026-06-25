import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const sessionId = String(body?.sessionId ?? '');
  const memberId = String(body?.memberId ?? '');
  const status = String(body?.status ?? 'present');
  const notes = body?.notes ? String(body.notes) : null;

  if (!sessionId || !memberId) {
    return NextResponse.json({ error: 'sessionId e memberId são obrigatórios.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.attendance.findUnique({
      where: { sessionId_memberId: { sessionId, memberId } },
    });

    if (existing) {
      return db.attendance.update({
        where: { id: existing.id },
        data: { status, notes },
      });
    }

    return db.attendance.create({
      data: { lodgeId: String(lodgeId), sessionId, memberId, status, notes },
    });
  });

  return NextResponse.json({ item });
}
