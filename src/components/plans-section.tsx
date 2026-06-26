'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PLANS, formatPrice } from '@/lib/stripe';

export function PlansSection() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(null);
    }
  }

  const plans = Object.values(PLANS);

  return (
    <section id="planos" className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <div className="max-w-2xl">
        <p className="font-display text-xs tracking-[0.4em] text-gold">PLANOS</p>
        <h2 className="font-display mt-5 text-[clamp(1.8rem,3.5vw,2.6rem)] font-semibold leading-tight text-sand-light">
          Do oriente pequeno à potência
        </h2>
        <p className="mt-4 text-base leading-7 text-sand">
          Por faixa de obreiros ativos. Comece com avaliação gratuita; ajuste o plano conforme a loja cresce.
        </p>
      </div>

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {plans.map((plan, i) => {
          const featured = i === 1;
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
                <span className="text-4xl font-semibold tabular-nums text-sand-light">{formatPrice(plan.price)}</span>
                <span className="text-sm text-sand-dark">/mês</span>
              </p>
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
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
