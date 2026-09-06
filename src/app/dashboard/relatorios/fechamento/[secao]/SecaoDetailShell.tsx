'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SecaoDetailShell({ title, lodgeName, initialFrom, initialTo, secao, children }: {
  title: string;
  lodgeName: string;
  initialFrom: string;
  initialTo: string;
  secao: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function apply() {
    router.push(`/dashboard/relatorios/fechamento/${secao}?from=${from}&to=${to}`);
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/dashboard/relatorios/fechamento" className="text-xs text-gold/70 transition hover:text-gold">&larr; Voltar ao painel de fechamento</Link>
            <h1 className="mt-2 font-display text-2xl font-bold text-sand-light">{title}</h1>
            <p className="mt-1 text-sm text-sand-dark">{lodgeName}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-sand-dark">De
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light" />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light" />
            </label>
            <button onClick={apply} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/90 hover:border-gold/60 hover:text-gold">Aplicar</button>
          </div>
        </div>

        {children}
      </div>
    </main>
  );
}
