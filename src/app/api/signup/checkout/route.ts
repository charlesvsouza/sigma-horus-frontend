import { ensurePrice, getStripe, isPlanId, TRIAL_DAYS, type BillingInterval } from '@/lib/stripe';
import { NextResponse } from 'next/server';

// Checkout PÚBLICO de self-service (sem login): o visitante escolhe o plano,
// põe o cartão e ganha trial de TRIAL_DAYS dias. O cartão é capturado já no
// início (payment_method_collection: 'always'); ao fim do trial o Stripe cobra
// automaticamente, salvo cancelamento. A loja é criada na volta (/comecar/concluir).
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const planId = String(body?.plan ?? 'oficina');
  const interval: BillingInterval = body?.interval === 'year' ? 'year' : 'month';

  if (!isPlanId(planId)) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  }

  const stripe = getStripe();
  const priceId = await ensurePrice(planId, interval);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const metadata = { selfSignup: 'true', plan: planId, interval };

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: TRIAL_DAYS, metadata },
    payment_method_collection: 'always', // cartão capturado durante o trial
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
    metadata,
    success_url: `${appUrl}/comecar/concluir?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/#planos`,
  });

  return NextResponse.json({ url: checkout.url });
}
