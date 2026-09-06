'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Closing } from '../types';
import { fmtDate, BalancoSection, BalanceteSection, ReceitasDespesasSection, LivroCaixaSection, CobrancasSection, SaldoIrmaosSection } from '../sections';

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 18mm 14mm; }
  body * { visibility: hidden !important; }
  .report-print, .report-print * { visibility: visible !important; }
  .report-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 10pt; }
  .report-noprint { display: none !important; }
  .report-print h2, .report-print h3 { color: #111 !important; }
  .report-print .rcard { background: #fff !important; border: none !important; padding: 0 !important; }
  .report-print table { width: 100%; border-collapse: collapse; }
  .report-print th, .report-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; }
  .report-print .report-section { break-inside: avoid; page-break-inside: avoid; }
  .report-print .pagebreak { break-before: page; page-break-before: always; }
}
`;

export default function FechamentoCompletoClient({ data, initialFrom, initialTo }: { data: Closing; initialFrom: string; initialTo: string }) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  // "Aplicar" navega pela URL → o Server Component recarrega os dados do período.
  function apply() {
    router.push(`/dashboard/relatorios/fechamento/completo?from=${from}&to=${to}`);
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="report-noprint flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/dashboard/relatorios/fechamento" className="text-xs text-gold/70 transition hover:text-gold">&larr; Voltar ao painel de fechamento</Link>
            <h1 className="mt-2 font-display text-2xl font-bold text-sand-light">Fechamento do veneralato — relatório completo</h1>
            <p className="mt-1 text-sm text-sand-dark">Relatório financeiro completo no formato livro caixa.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-sand-dark">De
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light" />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light" />
            </label>
            <button onClick={apply} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/90 hover:border-gold/60 hover:text-gold">Aplicar</button>
            <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-sigma-blue-deep hover:bg-gold-light">Salvar como PDF</button>
          </div>
        </div>

        <div className="report-print space-y-6">
          <header className="report-section text-center">
            <h2 className="text-xl font-bold text-sand-light">{data.meta.lodge}</h2>
            <p className="text-sm text-sand-dark">Relatório Financeiro — Fechamento do Veneralato</p>
            <p className="text-xs text-sand-dark">
              Período: {fmtDate(data.meta.from)} a {fmtDate(data.meta.to)}
              {data.meta.rite ? ` · ${data.meta.rite}` : ''}{data.meta.power ? ` · ${data.meta.power}` : ''}
            </p>
          </header>

          <BalancoSection data={data.balanco} />
          <BalanceteSection data={data.balancete} breakBefore />
          <ReceitasDespesasSection data={data.receitasDespesas} />
          <LivroCaixaSection data={data.livroCaixa} saldoAnterior={data.balanco.saldoAnterior} breakBefore />
          <CobrancasSection data={data.cobrancas} breakBefore />
          <SaldoIrmaosSection data={data.saldoIrmaos} breakBefore />
        </div>
      </div>
    </main>
  );
}
