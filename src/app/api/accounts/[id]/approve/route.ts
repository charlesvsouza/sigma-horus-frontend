import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Visto do Venerável Mestre numa despesa que ficou "aguardando aprovação"
// (valor >= limite configurado em Configurações → Financeiro). Só depois
// disso o Tesoureiro pode registrar o pagamento (ver POST /api/payments).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = normalizeRole(session?.user?.role);
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (role !== 'venerable' && role !== 'admin') {
    return NextResponse.json({ error: 'Apenas o Venerável Mestre ou o Administrador podem aprovar despesas.' }, { status: 403 });
  }

  const { id } = await params;

  const result = await withTenant(String(lodgeId), async (db) => {
    const account = await db.account.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!account) return { error: 'notfound' as const };
    if (account.type !== 'PAYABLE') return { error: 'notpayable' as const };

    const updated = await db.account.update({ where: { id }, data: { approvalStatus: 'approved' } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'account', entityId: id, metadata: { action: 'approve_expense', amount: account.amount } });
    return { updated };
  });

  if ('error' in result) {
    if (result.error === 'notfound') return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
    return NextResponse.json({ error: 'Só contas a pagar passam por aprovação.' }, { status: 400 });
  }

  return NextResponse.json({ item: result.updated });
}
