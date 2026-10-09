import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccessAny } from '@/lib/rbac';
import { parseVisitorFields } from '@/lib/visitors';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Liga um irmão visitante à sessão (a Secretaria digita a lista preenchida na sessão).
// Com `visitorId`, reaproveita o cadastro e atualiza os dados digitados; sem ele, procura pelo
// e-mail antes de criar outro cadastro do mesmo irmão.
export async function POST(request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccessAny(lodgeId, session.user.role, ['members', 'attendance'], 'write', session?.user?.memberId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id: sessionId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = parseVisitorFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { fields } = parsed;
  const visitorId = typeof body?.visitorId === 'string' && body.visitorId ? body.visitorId : null;
  // Consentimento vem da lista em papel (texto no rodapé); sem e-mail, não há o que consentir.
  const consentAt = body?.consent === true && fields.email ? new Date() : null;
  const degreeAtVisit = typeof body?.degreeAtVisit === 'string' && body.degreeAtVisit.trim() ? body.degreeAtVisit.trim().slice(0, 40) : fields.degree;

  const result = await withTenant(lodgeId, async (db) => {
    const meeting = await db.session.findFirst({ where: { id: sessionId, lodgeId }, select: { id: true } });
    if (!meeting) return { error: 'Sessão não encontrada.', status: 404 } as const;

    let visitor = visitorId
      ? await db.visitor.findFirst({ where: { id: visitorId, lodgeId, anonymizedAt: null }, select: { id: true } })
      : fields.email
        ? await db.visitor.findFirst({ where: { lodgeId, email: fields.email, anonymizedAt: null }, select: { id: true } })
        : null;
    if (visitorId && !visitor) return { error: 'Cadastro do visitante não encontrado.', status: 404 } as const;

    if (visitor) {
      await db.visitor.update({ where: { id: visitor.id }, data: { ...fields, ...(consentAt ? { consentAt } : {}) } });
    } else {
      visitor = await db.visitor.create({ data: { lodgeId, ...fields, consentAt }, select: { id: true } });
    }

    const existing = await db.sessionVisitor.findUnique({ where: { sessionId_visitorId: { sessionId, visitorId: visitor.id } }, select: { id: true } });
    if (existing) return { error: 'Este irmão já está na lista de visitantes desta sessão.', status: 409 } as const;

    const visit = await db.sessionVisitor.create({ data: { lodgeId, sessionId, visitorId: visitor.id, degreeAtVisit }, select: { id: true } });
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'CREATE', entity: 'session-visitor', entityId: visit.id, metadata: { sessionId, visitorId: visitor.id } });
    return { visitId: visit.id, visitorId: visitor.id } as const;
  });

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, ...result });
}
