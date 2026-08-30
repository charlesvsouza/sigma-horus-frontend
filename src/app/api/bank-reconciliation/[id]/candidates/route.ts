import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

const WINDOW_DAYS = 15;

// Candidatos pra vínculo manual: pagamentos ainda não conciliados, na mesma
// direção (receber/pagar) do lançamento bancário, dentro de uma janela de
// datas mais larga que o auto-match (que exige valor+data quase exatos).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;

  const items = await withTenant(String(lodgeId), async (db) => {
    const bankTx = await db.bankTransaction.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!bankTx) return [];

    const direction = bankTx.amount >= 0 ? 'RECEIVABLE' : 'PAYABLE';
    const from = new Date(bankTx.date.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const to = new Date(bankTx.date.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

    return db.payment.findMany({
      where: { lodgeId: String(lodgeId), paidAt: { gte: from, lte: to }, bankTransactions: { none: {} }, account: { type: direction } },
      select: { id: true, amount: true, paidAt: true, account: { select: { title: true } }, member: { select: { name: true } } },
      orderBy: { paidAt: 'desc' },
    });
  });

  return NextResponse.json({ items });
}
