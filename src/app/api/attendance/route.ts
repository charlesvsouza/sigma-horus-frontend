import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const sessionId = String(body?.sessionId ?? '');
  const memberId = String(body?.memberId ?? '');
  const status = String(body?.status ?? 'present');
  const notes = body?.notes ? String(body.notes) : null;

  if (!sessionId || !memberId) {
    return NextResponse.json({ error: 'sessionId e memberId são obrigatórios.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const meeting = await db.session.findFirst({ where: { id: sessionId, lodgeId: String(lodgeId) }, select: { endDate: true } });
    if (!meeting) return { error: 'not_found' as const };
    // Sessões sem endDate (cadastradas antes deste campo existir) não são
    // bloqueadas — o gate só vale pra sessões que já têm término definido.
    if (meeting.endDate && new Date() < meeting.endDate) {
      return { error: 'too_early' as const };
    }

    const existing = await db.attendance.findUnique({
      where: { sessionId_memberId: { sessionId, memberId } },
    });

    const item = existing
      ? await db.attendance.update({ where: { id: existing.id }, data: { status, notes } })
      : await db.attendance.create({ data: { lodgeId: String(lodgeId), sessionId, memberId, status, notes } });
    return { item };
  });

  if ('error' in result) {
    if (result.error === 'not_found') return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
    return NextResponse.json({ error: 'A presença só pode ser marcada depois do término da sessão.' }, { status: 400 });
  }

  return NextResponse.json({ item: result.item });
}
