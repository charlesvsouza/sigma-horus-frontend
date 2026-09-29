import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parseBRDateTimeLocal } from '@/lib/br-time';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { normalizeDegrees } from '@/lib/session-convocation';
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
  if (body?.date !== undefined) data.date = parseBRDateTimeLocal(String(body.date));
  if (body?.endDate !== undefined) data.endDate = body.endDate ? parseBRDateTimeLocal(String(body.endDate)) : null;
  if (body?.type !== undefined) data.type = String(body.type);
  if (body?.grade !== undefined) data.grade = body.grade ? String(body.grade) : null;
  if (body?.degrees !== undefined) {
    const degrees = normalizeDegrees(body.degrees);
    if (degrees.length === 0) return NextResponse.json({ error: 'Marque ao menos um grau trabalhado na sessão.' }, { status: 400 });
    data.degrees = degrees;
    data.grade = null; // o texto livre antigo deixa de valer quando os graus são marcados
  }
  if (body?.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body?.agenda !== undefined) data.agenda = body.agenda ? String(body.agenda) : null;
  if (body?.minutes !== undefined) data.minutes = body.minutes ? String(body.minutes) : null;
  if (data.title === '') return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 });
  for (const k of ['date', 'endDate'] as const) {
    const v = data[k];
    if (v instanceof Date && Number.isNaN(v.getTime())) return NextResponse.json({ error: 'Data ou horário inválido.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.session.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return { notFound: true as const };
    if (existing.locked) return { locked: true as const };
    const start = (data.date as Date | undefined) ?? existing.date;
    const end = data.endDate !== undefined ? (data.endDate as Date | null) : existing.endDate;
    if (end && end <= start) return { badRange: true as const };
    const updated = await db.session.update({ where: { id }, data });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'session', entityId: id, metadata: { fields: Object.keys(data) } });
    return { item: updated };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
  if ('locked' in result) return NextResponse.json({ error: 'Sessão trancada — peça ao Venerável ou Administrador para destrancar.' }, { status: 423 });
  if ('badRange' in result) return NextResponse.json({ error: 'O término precisa ser depois do início da sessão.' }, { status: 400 });
  return NextResponse.json({ item: result.item });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'members', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const deleted = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.session.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { title: true, locked: true } });
    if (!existing) return null;
    if (existing.locked) return { locked: true as const };
    await db.session.deleteMany({ where: { id, lodgeId: String(lodgeId) } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'session', entityId: id, metadata: { title: existing.title } });
    return existing;
  });
  if (!deleted) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });
  if ('locked' in deleted && deleted.locked) return NextResponse.json({ error: 'Sessão trancada — peça ao Venerável ou Administrador para destrancar.' }, { status: 423 });
  return NextResponse.json({ ok: true });
}
