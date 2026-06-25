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
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-2 block text-sm text-slate-400">De</label>
          <input
            type="date"
            value={fromVal}
            onChange={(e) => setFromVal(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-400">Até</label>
          <input
            type="date"
            value={toVal}
            onChange={(e) => setToVal(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white"
          />
        </div>
        <button
          onClick={aplicar}
          className="rounded-full bg-amber-400 px-5 py-3 font-medium text-slate-950"
        >
          Filtrar
        </button>
        {hasFilter && (
          <button
            onClick={limpar}
            className="rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-300"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </section>
  );
}
