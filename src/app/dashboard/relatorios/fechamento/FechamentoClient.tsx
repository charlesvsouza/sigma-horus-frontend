'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { money, fmtDate } from './sections';
import type { Closing } from './types';

export interface CardSummary {
  slug: string;
  title: string;
  keyLabel: string;
  keyValue: number;
  format: 'money' | 'count';
}

export default function FechamentoClient({ cards, meta, initialFrom, initialTo }: { cards: CardSummary[]; meta: Closing['meta']; initialFrom: string; initialTo: string }) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function apply() {
    router.push(`/dashboard/relatorios/fechamento?from=${from}&to=${to}`);
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Fechamento do veneralato</h1>
            <p className="mt-1 text-sm text-sand-dark">
              {meta.lodge} · {fmtDate(meta.from)} a {fmtDate(meta.to)}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-sand-dark">De
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light" />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light" />
            </label>
            <button onClick={apply} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/90 hover:border-gold/60 hover:text-gold">Aplicar</button>
            <Link
              href={`/dashboard/relatorios/fechamento/completo?from=${from}&to=${to}`}
              className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-sigma-blue-deep hover:bg-gold-light"
            >
              Ver relatório completo / PDF
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.slug}
              href={`/dashboard/relatorios/fechamento/${card.slug}?from=${from}&to=${to}`}
              className="group rounded-xl border border-white/[6%] bg-sigma-card p-6 transition-colors hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <h2 className="text-base font-semibold text-sand-light group-hover:text-gold">{card.title}</h2>
              <p className="mt-4 text-xs text-sand-dark">{card.keyLabel}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gold">
                {card.format === 'money' ? money(card.keyValue) : card.keyValue}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
