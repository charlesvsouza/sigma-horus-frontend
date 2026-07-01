import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/sygmahorus/apps/frontend/.env' });

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('STRIPE_SECRET_KEY ausente no .env');
  process.exit(1);
}

const stripe = new Stripe(secretKey, { typescript: true });

const TEST_PLAN = 'oficina';
const TEST_INTERVAL = 'month';

async function ensurePrice(plan, interval) {
  const lookupKey = interval === 'year' ? `sigma_${plan}_year_v3` : `sigma_${plan}_month_v2`;
  console.log(`[ensurePrice] lookupKey=${lookupKey}`);
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  console.log(`[ensurePrice] existing count=${existing.data.length}`);
  if (existing.data[0]) {
    console.log(`[ensurePrice] found priceId=${existing.data[0].id} amount=${existing.data[0].unit_amount}`);
    return existing.data[0].id;
  }
  const productSearch = await stripe.products.search({ query: `metadata['key']:'sigma_plan_${plan}'`, limit: 1 });
  const productId = productSearch.data?.[0]?.id;
  console.log(`[ensurePrice] productId=${productId || 'NOT_FOUND'}`);
  if (!productId) {
    throw new Error(`Produto sigma_plan_${plan} não encontrado no Stripe`);
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: 'brl',
    unit_amount: 8000,
    recurring: { interval },
    lookup_key: lookupKey,
    metadata: { plan, interval },
  });
  console.log(`[ensurePrice] created priceId=${price.id}`);
  return price.id;
}

async function createCheckout(priceId) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  console.log(`[checkout] appUrl=${appUrl}`);
  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: 10, metadata: { plan: TEST_PLAN, interval: TEST_INTERVAL } },
    payment_method_collection: 'always',
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
    metadata: { plan: TEST_PLAN, interval: TEST_INTERVAL },
    success_url: `${appUrl}/dashboard?billing=ok`,
    cancel_url: `${appUrl}/dashboard/assinatura?billing=cancel`,
  });
  console.log(`[checkout] sessionId=${checkout.id} url=${checkout.url}`);
  return checkout;
}

(async () => {
  try {
    const priceId = await ensurePrice(TEST_PLAN, TEST_INTERVAL);
    await createCheckout(priceId);
    console.log('\nOK: checkout criado com sucesso');
  } catch (err) {
    console.error('\nERRO:', err?.statusCode || err?.status || '', err?.message || err);
    if (err.raw) console.error('RAW:', JSON.stringify(err.raw, null, 2));
    console.error(err.stack || err);
    process.exit(1);
  }
})();
