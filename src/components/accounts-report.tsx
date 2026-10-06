'use client';

import { Fragment } from 'react';
import { ReportActions, ReportDocument } from '@/components/report/report-document';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { csvNumber } from '@/lib/csv';
import { daysLate, lineValue, reportTitleFor, situationOf, totalsOf, type Filters, type FilterAccount } from '@/lib/accounts-filter';

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
  // Em aberto e liquidado nunca se somam: o total "a receber" é só o que ainda falta receber.
  const t = totalsOf(rows);
  const mixed = t.receivableOpen.count + t.receivableDone.count > 0 && t.payableOpen.count + t.payableDone.count > 0;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const openNet = (x: ReturnType<typeof totalsOf>) => round2(x.receivableOpen.value - x.payableOpen.value);
  const doneNet = (x: ReturnType<typeof totalsOf>) => round2(x.receivableDone.value - x.payableDone.value);
  // Subtotal do grupo: o que está em aberto (com sinal, se houver os dois tipos) e o já liquidado.
  const groupOpen = (x: ReturnType<typeof totalsOf>) => (mixed ? openNet(x) : round2(x.receivableOpen.value + x.payableOpen.value));
  const groupDone = (x: ReturnType<typeof totalsOf>) => (mixed ? doneNet(x) : round2(x.receivableDone.value + x.payableDone.value));

  const totalLines: [string, number][] = [
    ...(t.receivableOpen.count > 0 ? [['Total a receber em aberto', t.receivableOpen.value] as [string, number]] : []),
    ...(t.receivableDone.count > 0 ? [['Total recebido', t.receivableDone.value] as [string, number]] : []),
    ...(t.payableOpen.count > 0 ? [['Total a pagar em aberto', t.payableOpen.value] as [string, number]] : []),
    ...(t.payableDone.count > 0 ? [['Total pago', t.payableDone.value] as [string, number]] : []),
    ...(mixed && t.receivableOpen.value + t.payableOpen.value > 0 ? [['Saldo em aberto (a receber − a pagar)', openNet(t)] as [string, number]] : []),
  ];

  const csvLine = (r: FilterAccount) => [formatDateOnly(r.dueDate), r.personName ?? '', r.title, r.chartName ?? '', r.type === 'RECEIVABLE' ? 'A receber' : 'A pagar', situationText(r, today), csvNumber(lineValue(r))];
  const csvRows: unknown[][] = [
    ['Vencimento', 'Pessoa', 'Título', 'Categoria', 'Tipo', 'Situação', 'Valor'],
    ...(groups ? groups.flatMap(([name, list]) => [...list.map(csvLine), ['', '', '', '', '', `Subtotal em aberto — ${name}`, csvNumber(groupOpen(totalsOf(list)))], ['', '', '', '', '', `Subtotal liquidado — ${name}`, csvNumber(groupDone(totalsOf(list)))]]) : rows.map(csvLine)),
    ...totalLines.map(([label, value]) => ['', '', '', '', '', label, csvNumber(value)]),
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
                          <td colSpan={5} className="px-2 py-2 text-right text-xs text-sand-dark">Subtotal em aberto — {name} · {list.length} lançamento{list.length === 1 ? '' : 's'}{groupDone(totalsOf(list)) !== 0 ? ` · liquidado ${brl(groupDone(totalsOf(list)))}` : ''}</td>
                          <td className="px-2 py-2 text-right num tabular-nums font-medium text-sand-light">{brl(groupOpen(totalsOf(list)))}</td>
                        </tr>
                      </Fragment>
                    ))
                  : rows.map(renderRow)}
                {totalLines.map(([label, value]) => (
                  <tr key={label} className="rpt-total"><td colSpan={5} className="px-2 py-2">{label}</td><td className="px-2 py-2 text-right num">{brl(value)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportDocument>
    </section>
  );
}
