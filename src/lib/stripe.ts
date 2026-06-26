import Stripe from 'stripe';
import { PLANS, type PlanId, type BillingInterval } from '@/lib/plans';

// Re-exporta os helpers/constantes puros (client-safe) para compatibilidade
// com os imports server-side existentes.
export {
  PLANS,
  ANNUAL_DISCOUNT,
  TRIAL_DAYS,
  TRIAL_PLAN,
  isPlanId,
  priceFor,
  formatPrice,
  comparePlans,
} from '@/lib/plans';
export type { PlanId, BillingInterval, PaymentMethod } from '@/lib/plans';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY não configurada.');
    }
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

/**
 * Garante (idempotente) o Product do plano no Stripe, identificado por metadata.
 */
async function ensureProduct(plan: PlanId): Promise<string> {
  const stripe = getStripe();
  const key = `sigma_plan_${plan}`;
  const found = await stripe.products
    .search({ query: `metadata['key']:'${key}'`, limit: 1 })
    .catch(() => null);
  if (found?.data?.[0]) return found.data[0].id;
  const product = await stripe.products.create({
    name: `Sigma Horus — ${PLANS[plan].name}`,
    metadata: { key },
  });
  return product.id;
}

/**
 * Garante (idempotente) o Price recorrente (cartão) para plano+intervalo,
 * usando lookup_key estável. Anual no cartão = 12× o mensal (sem desconto).
 * Retorna o id do Price para uso em subscriptions e schedules.
 */
export async function ensurePrice(plan: PlanId, interval: BillingInterval): Promise<string> {
  const stripe = getStripe();
  const lookupKey = `sigma_${plan}_${interval}`;
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const productId = await ensureProduct(plan);
  const amount = interval === 'year' ? PLANS[plan].price * 12 : PLANS[plan].price;
  const price = await stripe.prices.create({
    product: productId,
    currency: 'brl',
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookupKey,
    metadata: { plan, interval },
  });
  return price.id;
}
