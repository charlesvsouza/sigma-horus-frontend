'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, inputClass } from '@/components/ui';
import { ReportActions, ReportDocument } from '@/components/report/report-document';
import { brl } from '@/lib/currency';
import { csvNumber } from '@/lib/csv';

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
  issuedBy,
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
  issuedBy?: string | null;
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

  function csvRows(): unknown[][] {
    const out: unknown[][] = [['Grupo', 'Código', 'Conta', 'Período A', 'Período B', 'Variação', 'Variação %']];
    for (const [group, rows, a, b] of [['Receitas', revenueRows, comparison.totals.revenueA, comparison.totals.revenueB], ['Despesas', expenseRows, comparison.totals.expenseA, comparison.totals.expenseB]] as const) {
      for (const r of rows) out.push([group, r.code, r.name, csvNumber(r.valueA), csvNumber(r.valueB), csvNumber(r.variance), r.variancePct === null ? '' : r.variancePct.toFixed(1).replace('.', ',')]);
      out.push([`Total de ${group.toLowerCase()}`, '', '', csvNumber(a), csvNumber(b), csvNumber(a - b), '']);
    }
    out.push(['Resultado', '', '', csvNumber(comparison.totals.netA), csvNumber(comparison.totals.netB), csvNumber(comparison.totals.netA - comparison.totals.netB), '']);
    return out;
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rpt-noprint">
          <h1 className="font-display text-2xl font-bold text-sand-light">DRE comparativo</h1>
          <p className="mt-1 text-sm text-sand-dark">Receitas e despesas por conta do plano de contas, período A contra período B.</p>
        </div>

        <section className="rpt-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
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
            <ReportActions csv={() => ({ filename: `dre_${from}_${to}`, rows: csvRows() })} />

            <ReportDocument
              lodgeName={lodgeName}
              crestUrl={crestUrl}
              title="Demonstração do Resultado (DRE) comparativa"
              details={[`Período A: ${fmtDate(from)} a ${fmtDate(to)}`, `Período B: ${fmtDate(periodBFrom)} a ${fmtDate(periodBTo)}`, compareMode === 'yoy' ? 'mesmo período do ano anterior' : 'período anterior equivalente']}
              issuedBy={issuedBy}
            >
              <div className="rpt-section mb-6 grid gap-4 sm:grid-cols-2">
                <div className="rpt-card rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Saldo — Período A</p>
                  <p className={`mt-2 text-xl font-semibold ${comparison.totals.netA >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{brl(comparison.totals.netA)}</p>
                </div>
                <div className="rpt-card rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
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
                        {rows.length > 0 ? (
                          <tr className="rpt-total">
                            <td className="px-2 py-2 font-semibold text-sand-light">Total de {title.toLowerCase()}</td>
                            <td className="num px-2 py-2 text-right tabular-nums font-semibold text-sand-light">{brl(title === 'Receitas' ? comparison.totals.revenueA : comparison.totals.expenseA)}</td>
                            <td className="num px-2 py-2 text-right tabular-nums text-sand-dark">{brl(title === 'Receitas' ? comparison.totals.revenueB : comparison.totals.expenseB)}</td>
                            <td className="num px-2 py-2 text-right tabular-nums text-sand-dark">{brl(title === 'Receitas' ? comparison.totals.revenueA - comparison.totals.revenueB : comparison.totals.expenseA - comparison.totals.expenseB)}</td>
                            <td className="num px-2 py-2" />
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <table className="w-full text-sm">
                <tbody>
                  <tr className="rpt-total">
                    <td className="px-2 py-2 font-semibold text-sand-light">Resultado do período (receitas − despesas)</td>
                    <td className="num px-2 py-2 text-right tabular-nums font-semibold text-sand-light">{brl(comparison.totals.netA)}</td>
                    <td className="num px-2 py-2 text-right tabular-nums text-sand-dark">{brl(comparison.totals.netB)}</td>
                    <td className="num px-2 py-2 text-right tabular-nums text-sand-dark">{brl(comparison.totals.netA - comparison.totals.netB)}</td>
                    <td className="num px-2 py-2" />
                  </tr>
                </tbody>
              </table>
            </ReportDocument>
          </>
        )}
      </div>
    </main>
  );
}
