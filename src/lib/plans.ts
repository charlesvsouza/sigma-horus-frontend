// Constantes e helpers de planos SEM dependência do SDK do Stripe (Node).
// Seguro para importar em Client Components.

export const ANNUAL_DISCOUNT = 0.1; // anual no cartão (recompensa a auto-renovação)
export const ANNUAL_DISCOUNT_BOLETO = 0.05; // anual no boleto (pré-pago, sem renovação)
export const TRIAL_DAYS = 10;

export const PLANS = {
  oficina: {
    id: 'oficina',
    name: 'Oficina',
    price: 8000,
    rank: 1,
    maxMembers: 30,
    description: 'Para lojas com até 30 membros ativos.',
    features: [
      'Até 30 membros ativos',
      'Gestão financeira completa',
      'Cobranças e boletos',
      'Relatórios financeiros',
      'Presença em sessões',
    ],
  },
  loja: {
    id: 'loja',
    name: 'Loja',
    price: 11000,
    rank: 2,
    maxMembers: 80,
    description: 'Para lojas de 31 a 80 membros ativos.',
    features: [
      'Até 80 membros ativos',
      'Tudo do plano Oficina',
      'Exportação de relatórios',
      'Múltiplos administradores',
      'Suporte prioritário',
    ],
  },
  potencia: {
    id: 'potencia',
    name: 'Potência',
    price: 17000,
    rank: 3,
    maxMembers: Infinity,
    description: 'Para lojas com mais de 80 membros ou múltiplas lojas.',
    features: [
      'Membros ilimitados',
      'Tudo do plano Loja',
      'Multiloja',
      'Integração WhatsApp',
      'Onboarding dedicado',
      'SLA de suporte',
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type BillingInterval = 'month' | 'year';
export type PaymentMethod = 'card' | 'pix' | 'boleto';

export const TRIAL_PLAN: PlanId = 'oficina';

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && v in PLANS;
}

/** Percentual de desconto do plano anual conforme o método de pagamento. */
export function annualDiscountFor(method: PaymentMethod): number {
  return method === 'card' ? ANNUAL_DISCOUNT : ANNUAL_DISCOUNT_BOLETO;
}

/**
 * Valor total a cobrar, em centavos, para um plano + intervalo + método.
 * - Mensal: preço base (recorrente mensal, sem desconto).
 * - Anual no cartão: 12× com 10% de desconto e renovação automática.
 * - Anual no boleto: 12× com 5% de desconto, pré-pago (1 ano, sem renovação).
 */
export function priceFor(plan: PlanId, interval: BillingInterval, method: PaymentMethod): number {
  const base = PLANS[plan].price;
  if (interval === 'month') return base;
  const annual = base * 12;
  return Math.round(annual * (1 - annualDiscountFor(method)));
}

export function formatPrice(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/** Comparação de plano para distinguir upgrade de downgrade. */
export function comparePlans(a: PlanId, b: PlanId): number {
  return PLANS[a].rank - PLANS[b].rank;
}
