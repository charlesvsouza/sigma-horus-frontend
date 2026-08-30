import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Aprovação em sessão do balancete periódico (Venerável/Admin) — registra que
// foi apresentado e aprovado pela Loja, conforme exige o regulamento.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = normalizeRole(session?.user?.role);
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (role !== 'venerable' && role !== 'admin') {
    return NextResponse.json({ error: 'Apenas o Venerável Mestre ou o Administrador podem aprovar o balancete.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const presentedAt = body?.presentedAt ? new Date(body.presentedAt) : new Date();

  const item = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.balancete.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return null;

    const updated = await db.balancete.update({
      where: { id },
      data: { approved: true, approvedAt: new Date(), approvedById: session.user.id, presentedAt },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'balancete', entityId: id, metadata: { action: 'approve' } });
    return updated;
  });

  if (!item) return NextResponse.json({ error: 'Balancete não encontrado.' }, { status: 404 });
  return NextResponse.json({ item });
}
