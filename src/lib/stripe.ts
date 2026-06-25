import Stripe from 'stripe';

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

export const PLANS = {
  oficina: {
    id: 'oficina',
    name: 'Oficina',
    price: 3900,
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
    price: 6900,
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
    price: 11900,
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

export function formatPrice(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}
