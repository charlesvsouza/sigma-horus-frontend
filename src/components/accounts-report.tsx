'use client';

import { Fragment } from 'react';
import { ReportActions, ReportDocument } from '@/components/report/report-document';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { csvNumber } from '@/lib/csv';
import { daysLate, lineValue, reportTitleFor, situationOf, type Filters, type FilterAccount } from '@/lib/accounts-filter';

// Relatório da lista de Contas: imprime (PDF) ou exporta CSV exatamente o que está filtrado na tela. Substitui os relatórios
// separados "Contas a receber" e "Contas a pagar" (decisão do dono, 2026-10-04: uma tela só, com filtro).

function situationText(a: FilterAccount, today: Date): string {
  const s = situationOf(a, today);
  if (s === 'paid') return a.type === 'RECEIVABLE' ? 'Recebida' : 'Paga';
  if (s === 'overdue') { const d = daysLate(a, today); return `Vencida há ${d} ${d === 1 ? 'dia' : 'dias'}`; }
  return 'A vencer';
}

export default function AccountsReport({
  rows, filters, details, today, lodgeName, crestUrl, issuedBy,
}: {
  rows: FilterAccount[];
  filters: Filters;
  details: string[];
  today: Date;
  lodgeName: string;
  crestUrl: string | null;
  issuedBy: string | null;
}) {
  const title = reportTitleFor(filters.tipo);
  const grouped = filters.sort === 'person';
  const groups = grouped
    ? [...rows.reduce((m, r) => { const k = r.personName ?? 'Sem vínculo'; m.set(k, [...(m.get(k) ?? []), r]); return m; }, new Map<string, FilterAccount[]>())]
    : null;
  const sum = (list: FilterAccount[], type?: string) => Math.round(list.filter((r) => !type || r.type === type).reduce((s, r) => s + lineValue(r), 0) * 100) / 100;
  const receivable = sum(rows, 'RECEIVABLE');
  const payable = sum(rows, 'PAYABLE');
  const mixed = receivable > 0 && payable > 0;

  const csvLine = (r: FilterAccount) => [formatDateOnly(r.dueDate), r.personName ?? '', r.title, r.chartName ?? '', r.type === 'RECEIVABLE' ? 'A receber' : 'A pagar', situationText(r, today), csvNumber(lineValue(r))];
  const csvRows: unknown[][] = [
    ['Vencimento', 'Pessoa', 'Título', 'Categoria', 'Tipo', 'Situação', 'Valor'],
    ...(groups ? groups.flatMap(([name, list]) => [...list.map(csvLine), ['', '', '', '', '', `Subtotal — ${name}`, csvNumber(sum(list))]]) : rows.map(csvLine)),
    ['Total', '', '', '', '', '', csvNumber(mixed ? receivable - payable : receivable + payable)],
  ];

  const renderRow = (r: FilterAccount) => (
    <tr key={r.id}>
      <td className="border-b border-white/5 px-2 py-2 text-sand">{formatDateOnly(r.dueDate)}</td>
      <td className="border-b border-white/5 px-2 py-2 text-sand">{r.personName ?? '—'}</td>
      <td className="border-b border-white/5 px-2 py-2 text-sand">{r.title}</td>
      <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{r.chartName ?? '—'}</td>
      <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{situationText(r, today)}</td>
      <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-sand-light">{r.type === 'PAYABLE' && mixed ? '−' : ''}{brl(lineValue(r))}</td>
    </tr>
  );

  return (
    <section aria-label="Relatório da lista filtrada" className="space-y-4">
      <ReportActions csv={() => ({ filename: `${title.toLowerCase().replace(/\s+/g, '-')}-${today.toISOString().slice(0, 10)}`, rows: csvRows })} />
      <ReportDocument lodgeName={lodgeName} crestUrl={crestUrl} title={title} details={details.length > 0 ? details : ['Sem filtros: todas as contas carregadas']} issuedBy={issuedBy} orientation="landscape">
        {rows.length === 0 ? (
          <p className="text-sm text-sand-dark">Nenhuma conta com esses filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                  <th className="border-b border-white/10 px-2 py-2">Vencimento</th>
                  <th className="border-b border-white/10 px-2 py-2">Pessoa</th>
                  <th className="border-b border-white/10 px-2 py-2">Título</th>
                  <th className="border-b border-white/10 px-2 py-2">Categoria</th>
                  <th className="border-b border-white/10 px-2 py-2">Situação</th>
                  <th className="border-b border-white/10 px-2 py-2 text-right num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {groups
                  ? groups.map(([name, list]) => (
                      <Fragment key={name}>
                        <tr className="rpt-group"><td colSpan={6} className="border-b border-gold/25 px-2 pb-1.5 pt-5 text-xs font-semibold uppercase tracking-[0.12em] text-gold/90">{name}</td></tr>
                        {list.map(renderRow)}
                        <tr className="rpt-subtotal">
                          <td colSpan={5} className="px-2 py-2 text-right text-xs text-sand-dark">Subtotal — {name} · {list.length} lançamento{list.length === 1 ? '' : 's'}</td>
                          <td className="px-2 py-2 text-right num tabular-nums font-medium text-sand-light">{brl(sum(list))}</td>
                        </tr>
                      </Fragment>
                    ))
                  : rows.map(renderRow)}
                {mixed ? (
                  <>
                    <tr className="rpt-total"><td colSpan={5} className="px-2 py-2">Total a receber</td><td className="px-2 py-2 text-right num">{brl(receivable)}</td></tr>
                    <tr className="rpt-total"><td colSpan={5} className="px-2 py-2">Total a pagar</td><td className="px-2 py-2 text-right num">{brl(payable)}</td></tr>
                    <tr className="rpt-total"><td colSpan={5} className="px-2 py-2">Saldo (a receber − a pagar) — {rows.length} lançamentos</td><td className="px-2 py-2 text-right num">{brl(Math.round((receivable - payable) * 100) / 100)}</td></tr>
                  </>
                ) : (
                  <tr className="rpt-total"><td colSpan={5} className="px-2 py-2">Total — {rows.length} lançamento{rows.length === 1 ? '' : 's'}</td><td className="px-2 py-2 text-right num">{brl(receivable + payable)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </ReportDocument>
    </section>
  );
}
