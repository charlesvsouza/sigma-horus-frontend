import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccessAny } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string; visitId: string }> };

// Tira o visitante da lista da sessão (digitado por engano). O cadastro dele continua.
// Certificado já enviado trava: o documento existe e é verificável.
export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccessAny(lodgeId, session.user.role, ['members', 'attendance'], 'write', session?.user?.memberId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id: sessionId, visitId } = await params;
  const result = await withTenant(lodgeId, async (db) => {
    const visit = await db.sessionVisitor.findFirst({ where: { id: visitId, sessionId, lodgeId }, select: { id: true, certificateSentAt: true, visitorId: true } });
    if (!visit) return 'notfound' as const;
    if (visit.certificateSentAt) return 'sent' as const;
    await db.sessionVisitor.delete({ where: { id: visit.id } });
    await logAudit(db, { lodgeId, userId: session.user.id, action: 'DELETE', entity: 'session-visitor', entityId: visit.id, metadata: { sessionId, visitorId: visit.visitorId } });
    return 'ok' as const;
  });
  if (result === 'notfound') return NextResponse.json({ error: 'Visita não encontrada.' }, { status: 404 });
  if (result === 'sent') return NextResponse.json({ error: 'O certificado desta visita já foi enviado — ela não pode ser removida.' }, { status: 409 });
  return NextResponse.json({ success: true });
}
