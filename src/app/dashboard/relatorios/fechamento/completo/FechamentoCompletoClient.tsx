'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReportActions, ReportDocument, type Signatory } from '@/components/report/report-document';
import type { Closing } from '../types';
import { fmtDate, BalancoSection, BalanceteSection, ReceitasDespesasSection, LivroCaixaSection, CobrancasSection, SaldoIrmaosSection } from '../sections';

export default function FechamentoCompletoClient({ data, initialFrom, initialTo, issuedBy, signatures }: { data: Closing; initialFrom: string; initialTo: string; issuedBy?: string | null; signatures: Signatory[] }) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  // "Aplicar" navega pela URL → o Server Component recarrega os dados do período.
  function apply() {
    router.push(`/dashboard/relatorios/fechamento/completo?from=${from}&to=${to}`);
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rpt-noprint flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/dashboard/relatorios/fechamento" className="text-xs px-1 py-1 text-gold transition hover:text-gold-light">&larr; Voltar ao painel de fechamento</Link>
            <h1 className="mt-2 font-display text-2xl font-bold text-sand-light">Fechamento do veneralato — relatório completo</h1>
            <p className="mt-1 text-sm text-sand-dark">Relatório financeiro completo no formato livro caixa.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-sand-dark">De
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-white/8 bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light" />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border border-white/8 bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light" />
            </label>
            <button onClick={apply} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/90 hover:border-gold/60 hover:text-gold">Aplicar</button>
            <ReportActions />
          </div>
        </div>

        <ReportDocument
          lodgeName={data.meta.lodge}
          crestUrl={data.meta.crestUrl}
          title="Relatório financeiro — Fechamento do veneralato"
          details={[`Período: ${fmtDate(data.meta.from)} a ${fmtDate(data.meta.to)}`, data.meta.rite, data.meta.power]}
          issuedBy={issuedBy}
          signatures={signatures}
          className="space-y-6"
        >
          <BalancoSection data={data.balanco} />
          <BalanceteSection data={data.balancete} breakBefore />
          <ReceitasDespesasSection data={data.receitasDespesas} />
          <LivroCaixaSection data={data.livroCaixa} saldoAnterior={data.balanco.saldoAnterior} breakBefore />
          <CobrancasSection data={data.cobrancas} breakBefore />
          <SaldoIrmaosSection data={data.saldoIrmaos} breakBefore />
        </ReportDocument>
      </div>
    </main>
  );
}
