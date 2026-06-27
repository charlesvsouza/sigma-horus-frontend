'use client';

import { useState } from 'react';
import {
  PLANS,
  priceFor,
  formatPrice,
  comparePlans,
  type PlanId,
  type BillingInterval,
  type PaymentMethod,
} from '@/lib/plans';

interface Props {
  currentPlan: PlanId | null;
  isActiveCard: boolean; // assinatura de cartão já ativa (permite troca)
  pendingPlan: PlanId | null;
}

export function SubscriptionManager({ currentPlan, isActiveCard, pendingPlan }: Props) {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [method, setMethod] = useState<Extract<PaymentMethod, 'card' | 'boleto'>>('card');
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const isAnnual = interval === 'year';
  const effectiveMethod: PaymentMethod = isAnnual ? method : 'card';

  async function checkout(plan: PlanId) {
    setLoading(plan);
    setMsg(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval, method: effectiveMethod }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setMsg({ kind: 'err', text: data.error ?? 'Não foi possível iniciar o checkout.' });
    } finally {
      setLoading(null);
    }
  }

  async function changePlan(plan: PlanId) {
    setLoading(plan);
    setMsg(null);
    try {
      const res = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ kind: 'ok', text: data.message ?? 'Plano atualizado.' });
        setTimeout(() => window.location.reload(), 1500);
      } else if (data.needsCheckout) {
        await checkout(plan);
      } else {
        setMsg({ kind: 'err', text: data.error ?? 'Não foi possível trocar de plano.' });
      }
    } finally {
      setLoading(null);
    }
  }

  const plans = Object.values(PLANS);

  return (
    <div className="mt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-full border border-white/[0.1] bg-sigma-blue-dark/50 p-1">
          <button
            onClick={() => setInterval('month')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${!isAnnual ? 'bg-gold text-sigma-blue-deep' : 'text-sand-dark hover:text-sand-light'}`}
          >
            Mensal
          </button>
          <button
            onClick={() => setInterval('year')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${isAnnual ? 'bg-gold text-sigma-blue-deep' : 'text-sand-dark hover:text-sand-light'}`}
          >
            Anual
          </button>
        </div>
        {isAnnual ? (
          <div className="inline-flex rounded-full border border-white/[0.1] bg-sigma-blue-dark/50 p-1">
            <button
              onClick={() => setMethod('card')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${method === 'card' ? 'bg-gold/90 text-sigma-blue-deep' : 'text-sand-dark hover:text-sand-light'}`}
            >
              Cartão · 10% off (renova auto)
            </button>
            <button
              onClick={() => setMethod('boleto')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${method === 'boleto' ? 'bg-white/10 text-sand-light' : 'text-sand-dark hover:text-sand-light'}`}
            >
              Boleto · 5% off
            </button>
          </div>
        ) : null}
      </div>

      {/* Troca de plano só vale no cartão e no mesmo intervalo da assinatura.
          PIX/boleto exige contratar pelo checkout. */}
      {isActiveCard && isAnnual && method !== 'card' ? (
        <p className="mt-4 text-xs text-sand-dark">
          Troca direta de plano vale para cartão. Para anual via boleto, contrate pelo botão do plano.
        </p>
      ) : null}

      {msg ? (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${msg.kind === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}
        >
          {msg.text}
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const total = priceFor(plan.id, interval, effectiveMethod);
          const perMonth = isAnnual ? Math.round(total / 12) : total;
          const isCurrent = currentPlan === plan.id && !pendingPlan;
          const dir = currentPlan ? comparePlans(plan.id, currentPlan) : 1;
          const useChange = isActiveCard && (!isAnnual || method === 'card');
          let label = 'Assinar';
          if (useChange) label = dir > 0 ? 'Fazer upgrade' : dir < 0 ? 'Agendar downgrade' : 'Plano atual';
          const disabled = loading !== null || (useChange && isCurrent);

          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-6 ${currentPlan === plan.id ? 'border-gold/40 bg-sigma-blue-dark/80' : 'border-white/[0.08] bg-sigma-blue-dark/40'}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-sand-light">{plan.name}</h3>
                {currentPlan === plan.id ? (
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs text-gold">Atual</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-sand-dark">{plan.description}</p>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-sand-light">{formatPrice(perMonth)}</span>
                <span className="text-sm text-sand-dark">/mês</span>
              </p>
              <p className="mt-1 text-xs text-sand-dark">
                {isAnnual ? `${formatPrice(total)} por ano` : 'cobrança mensal'}
              </p>
              <div className="mt-auto pt-6">
                <button
                  onClick={() => (useChange ? changePlan(plan.id) : checkout(plan.id))}
                  disabled={disabled}
                  className="w-full rounded-full bg-gold px-6 py-3 text-sm font-medium text-sigma-blue-deep transition-colors hover:bg-gold-light disabled:opacity-40"
                >
                  {loading === plan.id ? 'Processando...' : label}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
