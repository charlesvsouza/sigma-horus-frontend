import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Cancela uma cobrança individual (não afeta a Account nem pagamentos já
// registrados — só remove o "título" de cobrança gerado). Bloqueada se já paga.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;

  const result = await withTenant(String(lodgeId), async (db) => {
    const invoice = await db.invoice.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!invoice) return { error: 'notfound' as const };
    if (invoice.status === 'paid') return { error: 'paid' as const };

    await db.invoice.delete({ where: { id } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'invoice', entityId: id, metadata: { number: invoice.number } });
    return { ok: true as const };
  });

  if ('error' in result) {
    if (result.error === 'notfound') return NextResponse.json({ error: 'Cobrança não encontrada.' }, { status: 404 });
    return NextResponse.json({ error: 'Cobrança já paga não pode ser cancelada.' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
