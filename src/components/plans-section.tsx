'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  PLANS,
  priceFor,
  formatPrice,
  type BillingInterval,
  type PaymentMethod,
} from '@/lib/plans';

export function PlansSection() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [method, setMethod] = useState<Extract<PaymentMethod, 'card' | 'boleto'>>('card');

  const isAnnual = interval === 'year';
  const effectiveMethod: PaymentMethod = isAnnual ? method : 'card';

  async function handleSubscribe(planId: string) {
    setLoading(planId);
    try {
      // Cartão: self-service público com teste grátis de 10 dias (visitante sem
      // conta entra direto no Stripe). Boleto anual pré-pago segue o fluxo
      // autenticado (exige conta) — cai em /login se não houver sessão.
      if (effectiveMethod === 'card') {
        const res = await fetch('/api/signup/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planId, interval }),
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        return;
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, interval, method: effectiveMethod }),
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  const plans = Object.values(PLANS);

  return (
    <section id="planos" className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <div className="max-w-2xl">
        <p className="font-display text-xs tracking-[0.4em] text-gold">PLANOS</p>
        <h2 className="mt-5 font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-semibold leading-tight text-sand-light">
          Do oriente pequeno à potência
        </h2>
        <p className="mt-4 text-base leading-7 text-sand">
          Por faixa de obreiros ativos. Comece com 10 dias de teste; ao final, assine um dos planos.
          No plano anual você ganha desconto: 10% no cartão, 5% no boleto.
        </p>
      </div>

      {/* Controles: intervalo e (no anual) método de pagamento */}
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-full border border-white/[0.1] bg-sigma-blue-dark/50 p-1">
          <button
            onClick={() => setInterval('month')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              !isAnnual ? 'bg-gold text-sigma-blue-deep' : 'text-sand-dark hover:text-sand-light'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setInterval('year')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              isAnnual ? 'bg-gold text-sigma-blue-deep' : 'text-sand-dark hover:text-sand-light'
            }`}
          >
            Anual
          </button>
        </div>

        {isAnnual ? (
          <div className="inline-flex rounded-full border border-white/[0.1] bg-sigma-blue-dark/50 p-1">
            <button
              onClick={() => setMethod('card')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                method === 'card' ? 'bg-gold/90 text-sigma-blue-deep' : 'text-sand-dark hover:text-sand-light'
              }`}
            >
              Cartão · 10% off (renova auto)
            </button>
            <button
              onClick={() => setMethod('boleto')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                method === 'boleto' ? 'bg-white/10 text-sand-light' : 'text-sand-dark hover:text-sand-light'
              }`}
            >
              Boleto · 5% off
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {plans.map((plan, i) => {
          const featured = i === 1;
          const total = priceFor(plan.id, interval, effectiveMethod);
          const perMonth = isAnnual ? Math.round(total / 12) : total;
          const fullAnnual = plan.price * 12;
          const isCardAnnual = effectiveMethod === 'card';
          const discountPct = isCardAnnual ? 10 : 5;
          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-8 transition-colors ${
                featured
                  ? 'border-gold/40 bg-sigma-blue-dark/80'
                  : 'border-white/[0.08] bg-sigma-blue-dark/40 hover:border-white/15'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold tracking-wide text-sand-light">{plan.name}</h3>
                {featured ? (
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold">
                    Mais escolhido
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-sand-dark">{plan.description}</p>

              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums text-sand-light">
                  {formatPrice(perMonth)}
                </span>
                <span className="text-sm text-sand-dark">/mês</span>
              </p>
              {isAnnual ? (
                <p className="mt-1 text-xs text-sand-dark">
                  {formatPrice(total)} por ano
                  <span className="ml-2 text-gold">{discountPct}% off (de {formatPrice(fullAnnual)})</span>
                  <span className="ml-2">{isCardAnnual ? '· renova auto' : '· pré-pago 1 ano'}</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-sand-dark">cobrança mensal no cartão</p>
              )}

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-sand">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading !== null}
                  className={`w-full rounded-full px-6 py-3 text-sm font-medium transition-all duration-300 ease-out disabled:opacity-50 ${
                    featured
                      ? 'bg-gold text-sigma-blue-deep hover:bg-gold-light'
                      : 'border border-gold/40 text-gold/90 hover:border-gold/60 hover:text-gold'
                  }`}
                >
                  {loading === plan.id ? 'Redirecionando...' : 'Assinar agora'}
                </button>
                {isAnnual && effectiveMethod !== 'card' ? (
                  <p className="mt-3 text-center text-[0.7rem] text-sand-dark">
                    Acesso liberado após a confirmação do pagamento.
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
