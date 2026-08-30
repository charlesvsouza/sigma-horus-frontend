'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inputClass } from '@/components/ui';

interface Row {
  chartAccountId: string;
  code: string;
  name: string;
  type: string;
  category: string | null;
  planned: number;
  realized: number;
  variance: number;
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const sum = (rows: Row[], key: 'planned' | 'realized') => rows.reduce((s, r) => s + r[key], 0);

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
      type="number"
      step="0.01"
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); const n = Number(draft); if (!Number.isNaN(n) && n !== value) onSave(n); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false); }}
      className={`${inputClass} w-28 !py-1 text-right`}
    />
  );
}

function Group({ title, rows, canEdit, onSave }: { title: string; rows: Row[]; canEdit: boolean; onSave: (chartAccountId: string, plannedAmount: number) => void }) {
  return (
    <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
      <h2 className="text-base font-semibold text-sand-light">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
              <th className="border-b border-white/10 px-2 py-2">Categoria</th>
              <th className="border-b border-white/10 px-2 py-2 text-right">Orçado</th>
              <th className="border-b border-white/10 px-2 py-2 text-right">Realizado</th>
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
                  <td className="border-b border-white/[5%] px-2 py-2 text-sand-light">{r.code} — {r.name}</td>
                  <td className="border-b border-white/[5%] px-2 py-2 text-right">
                    <EditableCell value={r.planned} disabled={!canEdit} onSave={(v) => onSave(r.chartAccountId, v)} />
                  </td>
                  <td className="border-b border-white/[5%] px-2 py-2 text-right tabular-nums text-sand">{brl(r.realized)}</td>
                  <td className={`border-b border-white/[5%] px-2 py-2 text-right tabular-nums ${over ? 'text-rose-300' : 'text-sand-dark'}`}>{brl(r.variance)}</td>
                  <td className="border-b border-white/[5%] px-2 py-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[6%]">
                      <div className={`h-full rounded-full ${over ? 'bg-rose-400/70' : 'bg-gold/70'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-sand-dark">Total</td>
              <td className="px-2 py-2 text-right text-sm font-semibold text-sand-light">{brl(sum(rows, 'planned'))}</td>
              <td className="px-2 py-2 text-right text-sm font-semibold text-sand-light">{brl(sum(rows, 'realized'))}</td>
              <td className="px-2 py-2" colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function OrcamentoClient({ year, items, canEdit }: { year: number; items: Row[]; canEdit: boolean }) {
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

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Orçamento anual</h1>
            <p className="mt-1 text-sm text-sand-dark">
              Defina a meta por categoria do plano de contas e acompanhe o realizado ao longo do ano.
              {canEdit ? ' Clique num valor orçado para editar.' : ''}
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs text-sand-dark">Ano
              <input type="number" value={yearInput} onChange={(e) => setYearInput(e.target.value)} className={`mt-1 block w-28 ${inputClass}`} />
            </label>
            <button onClick={() => router.push(`/dashboard/relatorios/orcamento?year=${yearInput}`)} className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/90 hover:border-gold/60 hover:text-gold">Aplicar</button>
          </div>
        </div>

        {message ? <p className="text-sm text-rose-300">{message}</p> : null}

        <Group title="Receitas" rows={revenues} canEdit={canEdit} onSave={savePlanned} />
        <Group title="Despesas" rows={expenses} canEdit={canEdit} onSave={savePlanned} />
      </div>
    </main>
  );
}
