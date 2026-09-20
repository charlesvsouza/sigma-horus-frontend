import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { brl } from '@/lib/currency';
import { getTroncoBalance } from '@/lib/hospitalaria';
import { findFundAccount } from '@/lib/funds';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';
import { isValidMoney } from '@/lib/money';

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
  if (!isValidMoney(amount)) {
    return NextResponse.json({ error: 'Informe um valor válido (maior que zero, com no máximo 2 casas decimais).' }, { status: 400 });
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

    const caixa = await findFundAccount(db, String(lodgeId), 'tronco');

    const account = await db.account.create({
      data: {
        lodgeId: String(lodgeId),
        type: 'PAYABLE',
        title: `Benemerência – ${campaign.title}`,
        amount,
        dueDate: new Date(),
        status: 'paid',
        chartAccountId: expenseAccount.id,
        bankAccountId: caixa?.id ?? null,
        description: 'Custeio pelo Tronco de Solidariedade',
      },
    });
    await db.payment.create({
      data: { lodgeId: String(lodgeId), accountId: account.id, bankAccountId: caixa?.id ?? null, amount, method: 'fund', note: `Custeio: ${campaign.title}` },
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
    if (result.error === 'insufficient') return NextResponse.json({ error: `Saldo do Tronco insuficiente (disponível: ${brl(result.balance)}).` }, { status: 400 });
    return NextResponse.json({ error: 'Configure a conta do Tronco de Solidariedade: use "Atualizar plano de contas" em Cadastros.' }, { status: 400 });
  }
  return NextResponse.json({ item: result.campaign });
}
