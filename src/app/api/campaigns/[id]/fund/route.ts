import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { getTroncoBalance } from '@/lib/hospitalaria';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Custeia a campanha pelo Tronco de Solidariedade: lança uma despesa de
// benemerência (saída paga) na conta solidária, reduzindo o saldo do fundo, e
// soma ao fundAllocated da campanha. Valida contra o saldo disponível.
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'campaigns', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const amount = Number(body?.amount ?? 0);
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Informe um valor válido.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const campaign = await db.campaign.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, title: true, fundAllocated: true } });
    if (!campaign) return { error: 'not_found' as const };

    const tronco = await getTroncoBalance(db, String(lodgeId));
    if (!tronco.configured) return { error: 'no_tronco' as const };
    if (amount > tronco.balance) return { error: 'insufficient' as const, balance: tronco.balance };

    const expenseAccount = await db.chartAccount.findFirst({
      where: { lodgeId: String(lodgeId), isSolidarity: true, type: 'EXPENSE' },
      select: { id: true },
    });
    if (!expenseAccount) return { error: 'no_tronco' as const };

    const account = await db.account.create({
      data: {
        lodgeId: String(lodgeId),
        type: 'PAYABLE',
        title: `Benemerência – ${campaign.title}`,
        amount,
        dueDate: new Date(),
        status: 'paid',
        chartAccountId: expenseAccount.id,
        description: 'Custeio pelo Tronco de Solidariedade',
      },
    });
    await db.payment.create({
      data: { lodgeId: String(lodgeId), accountId: account.id, amount, method: 'fund', note: `Custeio: ${campaign.title}` },
    });
    const updated = await db.campaign.update({
      where: { id },
      data: { fundAllocated: Number(campaign.fundAllocated) + amount },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'campaign', entityId: id, metadata: { fundedFromTronco: amount } });
    return { campaign: updated };
  });

  if ('error' in result) {
    if (result.error === 'not_found') return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });
    if (result.error === 'insufficient') return NextResponse.json({ error: `Saldo do Tronco insuficiente (disponível: R$ ${result.balance.toFixed(2)}).` }, { status: 400 });
    return NextResponse.json({ error: 'Configure a conta do Tronco de Solidariedade: use "Atualizar plano de contas" em Cadastros.' }, { status: 400 });
  }
  return NextResponse.json({ item: result.campaign });
}
