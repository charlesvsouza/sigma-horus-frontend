import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Registra uma doação voluntária e a LANÇA no financeiro, na conta do Tronco de
// Solidariedade (entrada paga): cria Account (recebível, baixada) + Payment, e
// vincula a doação. Assim o valor entra no caixa/fundo de verdade. O nome do
// doador é sempre guardado, mas pode ser ocultado na exibição (anonymous).
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
  const anonymous = Boolean(body?.anonymous);
  const donorName = String(body?.donorName ?? '').trim() || null;
  const note = String(body?.note ?? '').trim() || null;
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Informe um valor de doação válido.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const campaign = await db.campaign.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, title: true } });
    if (!campaign) return { error: 'not_found' as const };

    const tronco = await db.chartAccount.findFirst({
      where: { lodgeId: String(lodgeId), isSolidarity: true, type: 'REVENUE' },
      select: { id: true },
    });
    if (!tronco) return { error: 'no_tronco' as const };

    const display = anonymous ? 'Doação anônima' : donorName ?? 'Doador não identificado';

    // Lançamento financeiro: conta recebível já baixada na conta do Tronco.
    const account = await db.account.create({
      data: {
        lodgeId: String(lodgeId),
        type: 'RECEIVABLE',
        title: `Doação – ${campaign.title}`,
        amount,
        dueDate: new Date(),
        status: 'paid',
        chartAccountId: tronco.id,
        description: display,
      },
    });
    const payment = await db.payment.create({
      data: { lodgeId: String(lodgeId), accountId: account.id, amount, method: 'donation', note: display },
    });
    const donation = await db.campaignDonation.create({
      data: { lodgeId: String(lodgeId), campaignId: id, donorName, anonymous, amount, note, paymentId: payment.id },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'campaign-donation', entityId: donation.id, metadata: { amount, campaignId: id } });
    return { donation };
  });

  if ('error' in result) {
    if (result.error === 'not_found') return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });
    return NextResponse.json({ error: 'Configure a conta do Tronco de Solidariedade: use "Atualizar plano de contas" em Cadastros.' }, { status: 400 });
  }
  return NextResponse.json({ item: result.donation });
}
