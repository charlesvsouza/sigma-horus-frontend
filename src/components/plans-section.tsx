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

  return (
    <section id="planos" className="mx-auto max-w-7xl px-6 pb-24 lg:px-8">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-semibold text-white">Planos</h2>
        <p className="mt-3 text-slate-400">Escolha o plano ideal para o tamanho da sua loja.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {Object.values(PLANS).map((plan) => (
          <div
            key={plan.id}
            className="flex flex-col rounded-3xl border border-white/10 bg-slate-900/70 p-8 backdrop-blur"
          >
            <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
            <p className="mt-2 text-sm text-slate-400">{plan.description}</p>
            <p className="mt-6">
              <span className="text-4xl font-semibold text-amber-300">{formatPrice(plan.price)}</span>
              <span className="ml-2 text-sm text-slate-400">/mês</span>
            </p>
            <ul className="mt-8 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-8">
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading !== null}
                className="w-full rounded-full bg-amber-400 px-6 py-3 font-medium text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
              >
                {loading === plan.id ? 'Redirecionando...' : 'Assinar agora'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
