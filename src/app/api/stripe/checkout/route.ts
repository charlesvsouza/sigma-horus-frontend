import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import {
  getStripe,
  PLANS,
  priceFor,
  ensurePrice,
  isPlanId,
  type BillingInterval,
  type PaymentMethod,
} from '@/lib/stripe';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const planId = String(body?.plan ?? 'oficina');
  const interval: BillingInterval = body?.interval === 'year' ? 'year' : 'month';
  const rawMethod = String(body?.method ?? 'card');
  const method: PaymentMethod =
    rawMethod === 'pix' || rawMethod === 'boleto' ? rawMethod : 'card';

  if (!isPlanId(planId)) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  }
  // PIX/boleto só no anual pré-pago; mensal é sempre cartão.
  if (method !== 'card' && interval !== 'year') {
    return NextResponse.json(
      { error: 'PIX e boleto estão disponíveis apenas no plano anual.' },
      { status: 400 },
    );
  }

  const plan = PLANS[planId];
  const amount = priceFor(planId, interval, method);

  // Garante uma linha de subscription (já criada no trial; defensivo para legados).
  const data = await withTenant(String(lodgeId), async (db) => {
    const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) } });
    if (!lodge) return { notFound: true as const };
    let subscription = await db.subscription.findUnique({ where: { lodgeId: String(lodgeId) } });
    if (!subscription) {
      subscription = await db.subscription.create({
        data: { lodgeId: String(lodgeId), plan: planId, status: 'inactive' },
      });
    }
    return { lodge, subscription };
  });

  if ('notFound' in data) {
    return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
  }

  const { lodge, subscription } = data;
  const stripeObj = getStripe();

  const stripeCustomerId =
    subscription.stripeCustomerId ??
    (await stripeObj.customers.create({
      name: lodge.name,
      email: lodge.email ?? session?.user?.email ?? undefined,
      metadata: { lodgeId: String(lodgeId) },
    })).id;

  if (!subscription.stripeCustomerId) {
    await withTenant(String(lodgeId), (db) =>
      db.subscription.update({
        where: { id: subscription.id },
        data: { stripeCustomerId },
      }),
    );
  }

  const metadata = {
    lodgeId: String(lodgeId),
    plan: planId,
    interval,
    method,
  };
  const successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?billing=ok`;
  const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/assinatura?billing=cancel`;

  let checkout: Stripe.Checkout.Session;

  if (method === 'card') {
    // Recorrente (mensal ou anual) no cartão — renova automaticamente.
    const priceId = await ensurePrice(planId, interval);
    checkout = await stripeObj.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata },
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  } else {
    // Anual PIX/boleto — pagamento único pré-pago (1 ano). Acesso só após
    // confirmação (assíncrona) tratada no webhook.
    checkout = await stripeObj.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      payment_method_types: ['pix', 'boleto'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: { name: `${plan.name} (anual — PIX/boleto)`, description: plan.description },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: { metadata },
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  return NextResponse.json({ url: checkout.url });
}
