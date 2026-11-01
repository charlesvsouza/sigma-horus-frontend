import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccessAny } from '@/lib/rbac';
import { memberIdsRestricted } from '@/lib/member-restriction-server';
import { notConvokedReason, sessionDegrees } from '@/lib/session-convocation';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccessAny(String(lodgeId), session?.user?.role, ['members', 'attendance'], 'write', session?.user?.memberId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });
  const sessionId = String(body?.sessionId ?? '');
  const memberId = String(body?.memberId ?? '');
  const status = String(body?.status ?? 'present');
  const notes = body?.notes ? String(body.notes) : null;

  if (!sessionId || !memberId) {
    return NextResponse.json({ error: 'sessionId e memberId são obrigatórios.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const meeting = await db.session.findFirst({ where: { id: sessionId, lodgeId: String(lodgeId) }, select: { endDate: true, locked: true, date: true, degrees: true, grade: true } });
    if (!meeting) return { error: 'not_found' as const };
    if (meeting.locked) return { error: 'locked' as const };
    // Quem não foi convocado (bloqueado, licença, situação diferente de Ativo ou grau abaixo do de abertura
    // na data da sessão) não tem presença nem falta registrada.
    const member = await db.member.findFirst({
      where: { id: memberId, lodgeId: String(lodgeId) },
      select: { status: true, deceased: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true },
    });
    if (!member) return { error: 'member_not_found' as const };
    const onLeave = (await memberIdsRestricted(db, String(lodgeId), ['convocation'])).has(memberId);
    const reason = notConvokedReason(member, onLeave, sessionDegrees(meeting), meeting.date);
    if (reason) return { error: 'not_convoked' as const, reason };
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
    if (result.error === 'member_not_found') return NextResponse.json({ error: 'Irmão não encontrado.' }, { status: 404 });
    if (result.error === 'not_convoked') {
      const text = result.reason === 'degree'
        ? 'Este irmão não foi convocado: a sessão abre num grau acima do dele.'
        : result.reason === 'leave'
          ? 'Este irmão está em licença: não é convocado e não tem presença nem falta.'
          : 'Este irmão não está ativo (ex.: bloqueado — Potência): não é convocado e não tem presença nem falta.';
      return NextResponse.json({ error: text }, { status: 400 });
    }
    if (result.error === 'locked') return NextResponse.json({ error: 'Sessão trancada — peça ao Venerável ou Administrador para destrancar.' }, { status: 423 });
    return NextResponse.json({ error: 'A presença só pode ser marcada depois do término da sessão.' }, { status: 400 });
  }

  return NextResponse.json({ item: result.item });
}
