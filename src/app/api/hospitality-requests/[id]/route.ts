import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { isCandidateRole } from '@/lib/candidate';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// PATCH tem dois usos: a Hospitalaria marca o pedido como analisado (body.status) e o AUTOR corrige
// título/descrição enquanto o pedido ainda está pendente (body.title / body.description).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if ('title' in body || 'description' in body) {
    const memberId = session?.user?.memberId;
    if (!memberId || isCandidateRole(role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    const own = await requireLodgeAccess(String(lodgeId), role, 'portal', 'write');
    if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });
    const title = String(body?.title ?? '').trim();
    const description = body?.description ? String(body.description).trim() : null;
    if (!title) return NextResponse.json({ error: 'Informe um título para o pedido.' }, { status: 400 });

    const edited = await withTenant(String(lodgeId), async (db) => {
      const existing = await db.hospitalityRequest.findFirst({ where: { id, lodgeId: String(lodgeId), memberId: String(memberId) } });
      if (!existing) return { error: 'Pedido não encontrado.', status: 404 } as const;
      if (existing.status !== 'pending') return { error: 'Pedido já analisado pela Hospitalaria: não dá mais para editar.', status: 409 } as const;
      await db.hospitalityRequest.update({ where: { id }, data: { title, description } });
      await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'hospitality-request', entityId: id, metadata: { title, edited: true } });
      return { ok: true } as const;
    });
    if ('error' in edited) return NextResponse.json({ error: edited.error }, { status: edited.status });
    return NextResponse.json({ ok: true });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'campaigns', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const status = body?.status === 'reviewed' ? 'reviewed' : 'pending';

  const result = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.hospitalityRequest.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return { notFound: true as const };
    await db.hospitalityRequest.update({ where: { id }, data: { status } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'hospitality-request', entityId: id, metadata: { status } });
    return { ok: true as const };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
