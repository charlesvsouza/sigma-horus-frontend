'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, inputClass } from '@/components/ui';
import { ReportActions, ReportDocument } from '@/components/report/report-document';
import { brl } from '@/lib/currency';
import { csvNumber } from '@/lib/csv';

interface Row {
  chartAccountId: string;
  code: string;
  name: string;
  type: string;
  category: string | null;
  planned: number;
  launched: number;
  realized: number;
  variance: number;
}

const sum = (rows: Row[], key: 'planned' | 'launched' | 'realized') => rows.reduce((s, r) => s + r[key], 0);
const pctExecuted = (planned: number, realized: number) => (planned > 0 ? `${((realized / planned) * 100).toFixed(1).replace('.', ',')}%` : '—');

// Versão do documento (papel): sem a célula editável nem a barra de progresso.
function PrintGroup({ title, rows }: { title: string; rows: Row[] }) {
  const planned = sum(rows, 'planned');
  const launched = sum(rows, 'launched');
  const realized = sum(rows, 'realized');
  return (
    <div className="mt-4">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <table>
        <thead>
          <tr>
            <th className="text-left">Categoria</th>
            <th className="num">Orçado</th>
            <th className="num">Lançado</th>
            <th className="num">Liquidado</th>
            <th className="num">Diferença</th>
            <th className="num">% liquidado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.chartAccountId}>
              <td>{r.code} — {r.name}</td>
              <td className="num">{brl(r.planned)}</td>
              <td className="num">{brl(r.launched)}</td>
              <td className="num">{brl(r.realized)}</td>
              <td className="num">{brl(r.variance)}</td>
              <td className="num">{pctExecuted(r.planned, r.realized)}</td>
            </tr>
          ))}
          <tr className="rpt-total">
            <td>Total de {title.toLowerCase()}</td>
            <td className="num">{brl(planned)}</td>
            <td className="num">{brl(launched)}</td>
            <td className="num">{brl(realized)}</td>
            <td className="num">{brl(realized - planned)}</td>
            <td className="num">{pctExecuted(planned, realized)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EditableCell({ value, onSave, disabled }: { value: number; onSave: (v: number) => void; disabled: boolean }) {
  const [draft, setDraft] = useState(String(value || ''));
  const [editing, setEditing] = useState(false);

  if (disabled) return <span className="tabular-nums text-sand">{brl(value)}</span>;

  if (!editing) {
    return (
      <button onClick={() => { setDraft(String(value || '')); setEditing(true); }} className="tabular-nums text-sand underline decoration-dotted underline-offset-2 hover:text-gold">
        {brl(value)}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number" inputMode="decimal"
      step="0.01"
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); const n = Number(draft); if (!Number.isNaN(n) && n !== value) onSave(n); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false); }}
      className={`${inputClass} w-28 py-1! text-right`}
    />
  );
}

function Group({ title, rows, canEdit, onSave }: { title: string; rows: Row[]; canEdit: boolean; onSave: (chartAccountId: string, plannedAmount: number) => void }) {
  return (
    <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
      <h2 className="text-base font-semibold text-sand-light">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
              <th className="border-b border-white/10 px-2 py-2">Categoria</th>
              <th className="border-b border-white/10 px-2 py-2 text-right">Orçado</th>
              <th className="border-b border-white/10 px-2 py-2 text-right">Lançado</th>
              <th className="border-b border-white/10 px-2 py-2 text-right">Liquidado</th>
              <th className="border-b border-white/10 px-2 py-2 text-right">Diferença</th>
              <th className="border-b border-white/10 px-2 py-2">Progresso</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.planned > 0 ? Math.min(150, (r.realized / r.planned) * 100) : r.realized > 0 ? 100 : 0;
              const over = title === 'Despesas' ? r.realized > r.planned && r.planned > 0 : false;
              return (
                <tr key={r.chartAccountId}>
                  <td className="border-b border-white/5 px-2 py-2 text-sand-light">{r.code} — {r.name}</td>
                  <td className="border-b border-white/5 px-2 py-2 text-right">
                    <EditableCell value={r.planned} disabled={!canEdit} onSave={(v) => onSave(r.chartAccountId, v)} />
                  </td>
                  <td className="border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand-dark">{brl(r.launched)}</td>
                  <td className="border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand">{brl(r.realized)}</td>
                  <td className={`border-b border-white/5 px-2 py-2 text-right tabular-nums ${over ? 'text-rose-300' : 'text-sand-dark'}`}>{brl(r.variance)}</td>
                  <td className="border-b border-white/5 px-2 py-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/6">
                      <div className={`h-full rounded-full ${over ? 'bg-rose-400/70' : 'bg-gold/70'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-sand-dark">Total</td>
              <td className="px-2 py-2 text-right text-sm font-semibold text-sand-light">{brl(sum(rows, 'planned'))}</td>
              <td className="px-2 py-2 text-right text-sm font-semibold text-sand-dark">{brl(sum(rows, 'launched'))}</td>
              <td className="px-2 py-2 text-right text-sm font-semibold text-sand-light">{brl(sum(rows, 'realized'))}</td>
              <td className="px-2 py-2" colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function OrcamentoClient({
  year,
  items,
  canEdit,
  lodgeName,
  crestUrl,
  issuedBy,
}: {
  year: number;
  items: Row[];
  canEdit: boolean;
  lodgeName: string;
  crestUrl: string | null;
  issuedBy?: string | null;
}) {
  const router = useRouter();
  const [yearInput, setYearInput] = useState(String(year));
  const [message, setMessage] = useState('');

  async function savePlanned(chartAccountId: string, plannedAmount: number) {
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, chartAccountId, plannedAmount }),
    });
    if (res.ok) router.refresh();
    else setMessage((await res.json()).error ?? 'Erro ao salvar.');
  }

  const revenues = items.filter((i) => i.type === 'REVENUE');
  const expenses = items.filter((i) => i.type === 'EXPENSE');
  const netPlanned = sum(revenues, 'planned') - sum(expenses, 'planned');
  const netLaunched = sum(revenues, 'launched') - sum(expenses, 'launched');
  const netRealized = sum(revenues, 'realized') - sum(expenses, 'realized');

  function csvRows(): unknown[][] {
    const out: unknown[][] = [['Grupo', 'Código', 'Categoria', 'Orçado', 'Lançado', 'Liquidado', 'Diferença (liquidado − orçado)']];
    for (const [group, rows] of [['Receitas', revenues], ['Despesas', expenses]] as const) {
      for (const r of rows) out.push([group, r.code, r.name, csvNumber(r.planned), csvNumber(r.launched), csvNumber(r.realized), csvNumber(r.variance)]);
      out.push([`Total de ${group.toLowerCase()}`, '', '', csvNumber(sum(rows, 'planned')), csvNumber(sum(rows, 'launched')), csvNumber(sum(rows, 'realized')), csvNumber(sum(rows, 'realized') - sum(rows, 'planned'))]);
    }
    out.push(['Resultado (receitas − despesas)', '', '', csvNumber(netPlanned), csvNumber(netLaunched), csvNumber(netRealized), csvNumber(netRealized - netPlanned)]);
    return out;
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Orçamento anual</h1>
            <p className="mt-1 text-sm text-sand-dark">
              Defina a meta por categoria do plano de contas e acompanhe o lançado e o liquidado ao longo do ano.
              {canEdit ? ' Clique num valor orçado para editar.' : ''}
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs text-sand-dark">Ano
              <input type="number" inputMode="numeric" value={yearInput} onChange={(e) => setYearInput(e.target.value)} className={`mt-1 block w-28 ${inputClass}`} />
            </label>
            <button onClick={() => router.push(`/dashboard/relatorios/orcamento?year=${yearInput}`)} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/90 hover:border-gold/60 hover:text-gold">Aplicar</button>
          </div>
        </div>

        {message ? <Alert intent="danger">{message}</Alert> : null}

        <ReportActions disabled={items.length === 0} csv={() => ({ filename: `orcamento_${year}`, rows: csvRows() })} />

        <Group title="Receitas" rows={revenues} canEdit={canEdit} onSave={savePlanned} />
        <Group title="Despesas" rows={expenses} canEdit={canEdit} onSave={savePlanned} />

        <ReportDocument
          printOnly
          lodgeName={lodgeName}
          crestUrl={crestUrl}
          title={`Orçamento anual ${year} — orçado × liquidado`}
          details={[`Exercício de 01/01/${year} a 31/12/${year}`, 'lançado = contas com vencimento no ano, pagas ou em aberto; liquidado = o que já foi pago/recebido delas']}
          issuedBy={issuedBy}
        >
          <PrintGroup title="Receitas" rows={revenues} />
          <PrintGroup title="Despesas" rows={expenses} />
          <table className="mt-4">
            <tbody>
              <tr className="rpt-total">
                <td>Resultado (receitas − despesas)</td>
                <td className="num">{brl(netPlanned)}</td>
                <td className="num">{brl(netLaunched)}</td>
                <td className="num">{brl(netRealized)}</td>
                <td className="num">{brl(netRealized - netPlanned)}</td>
                <td className="num" />
              </tr>
            </tbody>
          </table>
        </ReportDocument>
      </div>
    </main>
  );
}
