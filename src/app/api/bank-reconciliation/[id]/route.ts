import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// PATCH: vincula manualmente (body.paymentId) ou ignora (body.status="ignored")
// uma linha do extrato importado. Sem body.paymentId nem status → volta a
// "unmatched" (desfaz vínculo/ignorar).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const item = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.bankTransaction.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return null;

    if (body?.paymentId) {
      const payment = await db.payment.findFirst({ where: { id: String(body.paymentId), lodgeId: String(lodgeId) }, select: { id: true } });
      if (!payment) return { error: 'payment-notfound' as const };
      return db.bankTransaction.update({ where: { id }, data: { status: 'matched', matchedPaymentId: payment.id } });
    }
    if (body?.status === 'ignored') {
      return db.bankTransaction.update({ where: { id }, data: { status: 'ignored', matchedPaymentId: null } });
    }
    return db.bankTransaction.update({ where: { id }, data: { status: 'unmatched', matchedPaymentId: null } });
  });

  if (!item) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
  if ('error' in item) return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
  return NextResponse.json({ item });
}
