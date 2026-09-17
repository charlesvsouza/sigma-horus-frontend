'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';

interface DreComparisonRow {
  code: string;
  name: string;
  category: string;
  type: 'REVENUE' | 'EXPENSE';
  valueA: number;
  valueB: number;
  variance: number;
  variancePct: number | null;
}

interface Comparison {
  rows: DreComparisonRow[];
  totals: { revenueA: number; revenueB: number; expenseA: number; expenseB: number; netA: number; netB: number };
}

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 16mm 14mm; }
  body * { visibility: hidden !important; }
  .dre-print, .dre-print * { visibility: visible !important; }
  .dre-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 9.5pt; }
  .dre-noprint { display: none !important; }
  .dre-print h1, .dre-print h2, .dre-print h3 { color: #111 !important; }
  .dre-print table { width: 100%; border-collapse: collapse; }
  .dre-print th, .dre-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; text-align: left; }
  .dre-print th { text-transform: uppercase; font-size: 8pt; border-bottom: 1.5px solid #333; }
  .dre-print .num { text-align: right; }
  .dre-print tr { break-inside: avoid; page-break-inside: avoid; }
}
`;

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');
}
function fmtPct(v: number | null) {
  if (v === null) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1).replace('.', ',')}%`;
}

export default function DreClient({
  lodgeName,
  crestUrl,
  from,
  to,
  compareMode,
  periodBFrom,
  periodBTo,
  activeTermStart,
  comparison,
}: {
  lodgeName: string;
  crestUrl: string | null;
  from: string;
  to: string;
  compareMode: 'previous' | 'yoy';
  periodBFrom: string;
  periodBTo: string;
  activeTermStart: string | null;
  comparison: Comparison;
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const [compareVal, setCompareVal] = useState(compareMode);

  function applyWith(nextFrom: string, nextTo: string, nextCompare: 'previous' | 'yoy') {
    const params = new URLSearchParams();
    if (nextFrom) params.set('from', nextFrom);
    if (nextTo) params.set('to', nextTo);
    params.set('compare', nextCompare);
    router.push(`/dashboard/relatorios/dre?${params.toString()}`);
  }

  function apply() {
    applyWith(fromVal, toVal, compareVal);
  }

  function shortcut(kind: 'mes-atual' | 'ano-atual' | 'veneralato') {
    const now = new Date();
    let f: Date;
    const t = now;
    if (kind === 'mes-atual') f = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (kind === 'ano-atual') f = new Date(now.getFullYear(), 0, 1);
    else f = activeTermStart ? new Date(`${activeTermStart}T00:00:00`) : new Date(now.getFullYear(), 0, 1);
    const fStr = f.toISOString().slice(0, 10);
    const tStr = t.toISOString().slice(0, 10);
    setFromVal(fStr);
    setToVal(tStr);
    applyWith(fStr, tStr, compareVal);
  }

  const revenueRows = comparison.rows.filter((r) => r.type === 'REVENUE' && (r.valueA !== 0 || r.valueB !== 0));
  const expenseRows = comparison.rows.filter((r) => r.type === 'EXPENSE' && (r.valueA !== 0 || r.valueB !== 0));

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="dre-noprint">
          <h1 className="font-display text-2xl font-bold text-sand-light">DRE comparativo</h1>
          <p className="mt-1 text-sm text-sand-dark">Receitas e despesas por conta do plano de contas, período A contra período B.</p>
        </div>

        <section className="dre-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.2fr_auto]">
            <label className="text-xs text-sand-dark">De (período A)
              <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Até (período A)
              <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Comparar com
              <select value={compareVal} onChange={(e) => setCompareVal(e.target.value as 'previous' | 'yoy')} className={`mt-1 ${inputClass}`}>
                <option value="previous">Período anterior equivalente</option>
                <option value="yoy">Mesmo período do ano anterior</option>
              </select>
            </label>
            <div className="flex items-end">
              <button onClick={apply} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
                Aplicar
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => shortcut('mes-atual')} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">Mês atual</button>
            <button onClick={() => shortcut('ano-atual')} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">Ano atual</button>
            {activeTermStart ? (
              <button onClick={() => shortcut('veneralato')} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">Este veneralato</button>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-sand-dark">
            Período B calculado automaticamente: <strong className="text-sand-light">{fmtDate(periodBFrom)} a {fmtDate(periodBTo)}</strong>
          </p>
        </section>

        {comparison.rows.length === 0 ? (
          <EmptyState title="Nenhum lançamento nos dois períodos." description="Ajuste o período ou registre pagamentos para comparar." />
        ) : (
          <>
            <div className="dre-noprint">
              <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
                Salvar como PDF
              </button>
            </div>

            <section className="rounded-xl border border-white/6 bg-sigma-card p-6 dre-print">
              <header className="mb-5 text-center">
                {crestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
                ) : null}
                <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
                <h2 className="mt-0.5 text-sm text-sand-dark">DRE comparativo</h2>
                <p className="mt-0.5 text-xs text-sand-dark">
                  Período A: {fmtDate(from)} a {fmtDate(to)} · Período B: {fmtDate(periodBFrom)} a {fmtDate(periodBTo)}
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Saldo — Período A</p>
                  <p className={`mt-2 text-xl font-semibold ${comparison.totals.netA >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{brl(comparison.totals.netA)}</p>
                </div>
                <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Saldo — Período B</p>
                  <p className={`mt-2 text-xl font-semibold ${comparison.totals.netB >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{brl(comparison.totals.netB)}</p>
                </div>
              </div>

              {([['Receitas', revenueRows], ['Despesas', expenseRows]] as const).map(([title, rows]) => (
                <div key={title} className="mb-6">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-sand-light">{title}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                          <th className="border-b border-white/10 px-2 py-2">Conta</th>
                          <th className="border-b border-white/10 px-2 py-2 text-right num">Período A</th>
                          <th className="border-b border-white/10 px-2 py-2 text-right num">Período B</th>
                          <th className="border-b border-white/10 px-2 py-2 text-right num">Variação</th>
                          <th className="border-b border-white/10 px-2 py-2 text-right num">Variação %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr><td className="px-2 py-3 text-sand-dark" colSpan={5}>Sem lançamentos.</td></tr>
                        ) : rows.map((r) => {
                          const goodDirection = title === 'Receitas' ? r.variance >= 0 : r.variance <= 0;
                          return (
                            <tr key={`${r.type}:${r.code}`}>
                              <td className="border-b border-white/5 px-2 py-2 text-sand-light"><span className="text-sand-dark">{r.code}</span> · {r.name}</td>
                              <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-sand">{brl(r.valueA)}</td>
                              <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-sand-dark">{brl(r.valueB)}</td>
                              <td className={`border-b border-white/5 px-2 py-2 text-right num tabular-nums ${goodDirection ? 'text-emerald-300' : 'text-rose-300'}`}>{brl(r.variance)}</td>
                              <td className={`border-b border-white/5 px-2 py-2 text-right num tabular-nums ${goodDirection ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtPct(r.variancePct)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
