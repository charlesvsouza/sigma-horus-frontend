'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function FiltrosRelatorios({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);

  function aplicar() {
    const params = new URLSearchParams();
    if (fromVal) params.set('from', fromVal);
    if (toVal) params.set('to', toVal);
    router.push(`/dashboard/relatorios?${params.toString()}`);
  }

  function limpar() {
    setFromVal('');
    setToVal('');
    router.push('/dashboard/relatorios');
  }

  const hasFilter = !!from || !!to;

  return (
    <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-2 block text-sm text-sand-dark">De</label>
          <input
            type="date"
            value={fromVal}
            onChange={(e) => setFromVal(e.target.value)}
            className="rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-sand-dark">Até</label>
          <input
            type="date"
            value={toVal}
            onChange={(e) => setToVal(e.target.value)}
            className="rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
          />
        </div>
        <button
          onClick={aplicar}
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark"
        >
          Filtrar
        </button>
        {hasFilter && (
          <button
            onClick={limpar}
            className="rounded-full border border-white/[8%] px-5 py-2.5 text-sm text-sand transition-colors hover:border-white/20"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </section>
  );
}
