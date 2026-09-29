import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { anonymizedVisitor, parseVisitorFields } from '@/lib/visitors';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

async function guard() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'members', 'write');
  if (!access.ok) return { ok: false as const, res: NextResponse.json({ error: access.error }, { status: access.status }) };
  return { ok: true as const, lodgeId, userId: session.user.id };
}

// Corrige o cadastro do visitante (vale para as próximas visitas e certificados).
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = parseVisitorFields(await request.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const updated = await withTenant(g.lodgeId, async (db) => {
    const found = await db.visitor.findFirst({ where: { id, lodgeId: g.lodgeId, anonymizedAt: null }, select: { id: true } });
    if (!found) return null;
    const item = await db.visitor.update({ where: { id }, data: parsed.fields });
    await logAudit(db, { lodgeId: g.lodgeId, userId: g.userId, action: 'UPDATE', entity: 'visitor', entityId: id, metadata: { fields: Object.keys(parsed.fields) } });
    return item;
  });
  if (!updated) return NextResponse.json({ error: 'Visitante não encontrado.' }, { status: 404 });
  return NextResponse.json({ item: updated });
}

// Exclusão a pedido do visitante (LGPD): apaga os dados pessoais e mantém as visitas, para a
// contagem de presença das sessões não mudar. Não tem volta.
export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await guard();
  if (!g.ok) return g.res;
  const { id } = await params;
  const done = await withTenant(g.lodgeId, async (db) => {
    const found = await db.visitor.findFirst({ where: { id, lodgeId: g.lodgeId, anonymizedAt: null }, select: { id: true } });
    if (!found) return false;
    await db.visitor.update({ where: { id }, data: anonymizedVisitor() });
    await logAudit(db, { lodgeId: g.lodgeId, userId: g.userId, action: 'DELETE', entity: 'visitor', entityId: id, metadata: { anonymized: true } });
    return true;
  });
  if (!done) return NextResponse.json({ error: 'Visitante não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
