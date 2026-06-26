import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import {
  getStripe,
  PLANS,
  ensurePrice,
  isPlanId,
  comparePlans,
  type BillingInterval,
  type PlanId,
} from '@/lib/stripe';
import { NextResponse } from 'next/server';

// Troca de plano de uma assinatura de CARTÃO já ativa.
// - Upgrade: imediato, com cobrança proporcional da diferença.
// - Downgrade: agendado para o fim do período vigente (sem reembolso).
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const newPlan = String(body?.plan ?? '');
  if (!isPlanId(newPlan)) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  }

  const sub = await withTenant(String(lodgeId), (db) =>
    db.subscription.findUnique({ where: { lodgeId: String(lodgeId) } }),
  );
  if (!sub) {
    return NextResponse.json({ error: 'Assinatura não encontrada.' }, { status: 404 });
  }

  const currentPlan = sub.plan as PlanId;
  const interval = (sub.billingInterval as BillingInterval) ?? 'month';

  if (newPlan === currentPlan && !sub.pendingPlan) {
    return NextResponse.json({ error: 'Você já está neste plano.' }, { status: 400 });
  }

  // Trial ou anual pré-pago (sem assinatura recorrente no Stripe): a troca se dá
  // contratando o novo plano no checkout.
  if (!sub.stripeSubscriptionId) {
    return NextResponse.json(
      { error: 'Para mudar de plano agora, contrate pelo checkout.', needsCheckout: true },
      { status: 409 },
    );
  }

  const stripe = getStripe();
  const direction = comparePlans(newPlan, currentPlan); // >0 upgrade, <0 downgrade

  // Libera qualquer downgrade agendado anterior antes de agir.
  if (sub.stripeScheduleId) {
    await stripe.subscriptionSchedules.release(sub.stripeScheduleId).catch(() => {});
  }

  const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const itemId = stripeSub.items.data[0]?.id;
  const currentPriceId = stripeSub.items.data[0]?.price?.id;
  if (!itemId || !currentPriceId) {
    return NextResponse.json({ error: 'Item da assinatura não encontrado.' }, { status: 500 });
  }

  if (direction > 0) {
    // UPGRADE — imediato, cobra a diferença proporcional.
    const newPriceId = await ensurePrice(newPlan, interval);
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'always_invoice',
    });
    await withTenant(String(lodgeId), (db) =>
      db.subscription.update({
        where: { id: sub.id },
        data: {
          plan: newPlan,
          pendingPlan: null,
          pendingPlanEffectiveAt: null,
          stripeScheduleId: null,
        },
      }),
    );
    return NextResponse.json({
      ok: true,
      kind: 'upgrade',
      message: `Plano atualizado para ${PLANS[newPlan].name} imediatamente.`,
    });
  }

  // DOWNGRADE — agenda a troca para o fim do período vigente.
  const periodEnd = (stripeSub as { current_period_end?: number }).current_period_end;
  const phaseStart = stripeSub.items.data[0] ? (stripeSub as { current_period_start?: number }).current_period_start : undefined;
  const newPriceId = await ensurePrice(newPlan, interval);

  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: sub.stripeSubscriptionId,
  });

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    phases: [
      {
        items: [{ price: currentPriceId, quantity: 1 }],
        start_date: phaseStart ?? schedule.phases[0]?.start_date,
        end_date: periodEnd,
      },
      {
        items: [{ price: newPriceId, quantity: 1 }],
      },
    ],
    metadata: { lodgeId: String(lodgeId), pendingPlan: newPlan },
  });

  const effectiveAt = periodEnd ? new Date(periodEnd * 1000) : null;
  await withTenant(String(lodgeId), (db) =>
    db.subscription.update({
      where: { id: sub.id },
      data: {
        pendingPlan: newPlan,
        pendingPlanEffectiveAt: effectiveAt,
        stripeScheduleId: schedule.id,
      },
    }),
  );

  return NextResponse.json({
    ok: true,
    kind: 'downgrade',
    effectiveAt,
    message: `Downgrade para ${PLANS[newPlan].name} agendado para o fim do período atual. Sem reembolso de valores já pagos.`,
  });
}
