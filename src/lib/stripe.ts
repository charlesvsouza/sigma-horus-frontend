import Stripe from 'stripe';
import { PLANS, priceFor, type PlanId, type BillingInterval } from '@/lib/plans';

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
  // Filtra por active:'true' — senão a busca pode devolver um produto ARQUIVADO
  // (havia duplicados arquivados), e um Price anexado a produto inativo não pode
  // ser comprado ("product is not active"), quebrando o checkout.
  const found = await stripe.products
    .search({ query: `metadata['key']:'${key}' AND active:'true'`, limit: 1 })
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
 * usando lookup_key estável. Anual no cartão = 12× o mensal com 10% de desconto
 * (ver priceFor). As lookup_keys são versionadas para invalidar Prices antigos
 * quando o valor muda — Prices no Stripe são imutáveis. Assinaturas já criadas
 * permanecem no Price antigo (grandfathered); novos checkouts usam o novo.
 * Versão atual: mês `_v2`, ano `_v3` (tabela 80/110/170, calibrada 2026-06-29).
 * Retorna o id do Price para uso em subscriptions e schedules.
 */
export async function ensurePrice(plan: PlanId, interval: BillingInterval): Promise<string> {
  const stripe = getStripe();
  const lookupKey = interval === 'year' ? `sigma_${plan}_year_v3` : `sigma_${plan}_month_v2`;
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const productId = await ensureProduct(plan);
  const amount = priceFor(plan, interval, 'card');
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
