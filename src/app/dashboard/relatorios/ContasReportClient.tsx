'use client';

import { SELECTABLE_SETTLEMENTS, SETTLEMENT_LABEL, type SettlementType } from '@/lib/settlement-type';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { EmptyState, inputClass } from '@/components/ui';
import { ReportActions, ReportDocument } from '@/components/report/report-document';
import { brl } from '@/lib/currency';
import { formatDayMixed } from '@/lib/date-only';
import { csvNumber } from '@/lib/csv';
import { ACCOUNTS_SORT_LABEL, sortHasGroups, type AccountsSort } from '@/lib/accounts-report';

interface PersonOption { id: string; name: string; }
interface ReportRow { id: string; date: string; personId: string | null; personName: string | null; description: string; category: string | null; amount: number; reference: string | null; detail: string | null; settlement?: string | null; }
interface ReportGroup { label: string; rows: ReportRow[]; total: number; }

function fmtDate(iso: string) {
  return formatDayMixed(iso);
}

export default function ContasReportClient({
  basePath,
  title,
  description,
  dateLabel,
  lodgeName,
  crestUrl,
  issuedBy,
  people,
  from,
  to,
  personId,
  text,
  showSettlement = false,
  settlement = '',
  sort,
  subtotals,
  report,
}: {
  basePath: string;
  title: string;
  description: string;
  dateLabel: string;
  lodgeName: string;
  crestUrl: string | null;
  issuedBy?: string | null;
  people: PersonOption[];
  from: string;
  to: string;
  personId: string;
  text: string;
  /** Mostra a coluna e o filtro "Tipo de baixa" (contas já recebidas/pagas). */
  showSettlement?: boolean;
  settlement?: string;
  sort: AccountsSort;
  subtotals: boolean;
  report: { rows: ReportRow[]; total: number; groups: ReportGroup[] | null };
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const [personVal, setPersonVal] = useState(personId);
  const [textVal, setTextVal] = useState(text);
  const [settlementVal, setSettlementVal] = useState(settlement);
  const cols = showSettlement ? 6 : 5;
  const [sortVal, setSortVal] = useState(sort);
  const [subVal, setSubVal] = useState(subtotals);
  const canGroup = sortHasGroups(sortVal);

  // A ordem 'data' segue a coluna de data da tela (Vencimento, Recebimento ou Pagamento).
  const sortLabel = (s: AccountsSort) => (s === 'data' ? dateLabel : ACCOUNTS_SORT_LABEL[s]);

  function apply(nextSort: AccountsSort = sortVal, nextSub: boolean = subVal) {
    const params = new URLSearchParams();
    if (fromVal) params.set('from', fromVal);
    if (toVal) params.set('to', toVal);
    if (personVal) params.set('personId', personVal);
    if (textVal) params.set('text', textVal);
    if (showSettlement && settlementVal) params.set('settlement', settlementVal);
    if (nextSort !== 'referencia') params.set('sort', nextSort);
    if (!nextSub) params.set('sub', '0');
    router.push(`${basePath}?${params.toString()}`);
  }

  const xlsHref = `/api/reports/accounts/xlsx?variant=${basePath.split('/').pop()}&from=${fromVal}&to=${toVal}${personVal ? `&personId=${personVal}` : ''}${textVal ? `&text=${encodeURIComponent(textVal)}` : ''}${showSettlement && settlementVal ? `&settlement=${settlementVal}` : ''}${sort !== 'referencia' ? `&sort=${sort}` : ''}${subtotals ? '' : '&sub=0'}`;

  // Contas em aberto sem datas no filtro = todas as pendências (não "Invalid Date").
  const period = from || to
    ? `Período: ${from ? fmtDate(`${from}T00:00:00`) : 'início'} a ${to ? fmtDate(`${to}T00:00:00`) : 'hoje'}`
    : 'Todas as pendências, sem limite de data';
  const personName = personId ? people.find((p) => p.id === personId)?.name : null;
  const details = [period, personName ? `Pessoa: ${personName}` : null, text ? `Busca: "${text}"` : null, showSettlement && settlement ? `Tipo de baixa: ${SETTLEMENT_LABEL[settlement as SettlementType]}` : null, `Ordenado por: ${sortLabel(sort === 'nenhuma' ? 'referencia' : sort)}${sortHasGroups(sort) && !subtotals ? ', sem subtotais' : ''}`];
  const settleText = (r: ReportRow) => (r.settlement && r.settlement in SETTLEMENT_LABEL ? SETTLEMENT_LABEL[r.settlement as SettlementType] : '—');
  const csvLine = (r: ReportRow) => [fmtDate(r.date), r.personName ?? '', r.reference ?? '', r.category ?? '', r.detail ?? '', ...(showSettlement ? [settleText(r)] : []), csvNumber(r.amount)];
  const csvRows = [
    [dateLabel, 'Nome', 'Referência', 'Categoria', 'Detalhe', ...(showSettlement ? ['Tipo de baixa'] : []), 'Valor'],
    ...(report.groups
      ? report.groups.flatMap((g) => [...g.rows.map(csvLine), ['', '', '', '', ...(showSettlement ? [''] : []), `Subtotal — ${g.label}`, csvNumber(g.total)]])
      : report.rows.map(csvLine)),
    ['Total', '', '', '', ...(showSettlement ? [''] : []), '', csvNumber(report.total)],
  ];

  const renderRow = (r: ReportRow) => (
    <tr key={r.id}>
      <td className="border-b border-white/5 px-2 py-2 text-sand">{fmtDate(r.date)}</td>
      <td className="border-b border-white/5 px-2 py-2 text-sand">{r.personName ?? '—'}</td>
      <td className="border-b border-white/5 px-2 py-2 text-sand">{r.reference ?? '—'}</td>
      <td className="border-b border-white/5 px-2 py-2 text-sand-dark">
        {r.category ?? (r.detail ? null : '—')}
        {r.detail ? <span className={r.category ? 'block text-xs text-sand-dark/80' : 'text-sand'}>{r.detail}</span> : null}
      </td>
      {showSettlement ? <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{settleText(r)}</td> : null}
      <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-sand-light">{brl(r.amount)}</td>
    </tr>
  );

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rpt-noprint">
          <h1 className="font-display text-2xl font-bold text-sand-light">{title}</h1>
          <p className="mt-1 text-sm text-sand-dark">{description}</p>
        </div>

        <section className="rpt-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className={`grid gap-4 ${showSettlement ? 'md:grid-cols-[1fr_1fr_1.4fr_1.4fr_1.3fr_1.3fr_auto_auto]' : 'md:grid-cols-[1fr_1fr_1.4fr_1.4fr_1.3fr_auto_auto]'}`}>
            <label className="text-xs text-sand-dark">De
              <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Pessoa
              <select value={personVal} onChange={(e) => setPersonVal(e.target.value)} className={`mt-1 ${inputClass}`}>
                <option value="">Todos</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-sand-dark">Categoria, descrição ou referência
              <input value={textVal} onChange={(e) => setTextVal(e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Buscar…" />
            </label>
            {showSettlement ? (
              <label className="text-xs text-sand-dark">Tipo de baixa
                <select value={settlementVal} onChange={(e) => setSettlementVal(e.target.value)} className={`mt-1 ${inputClass}`}>
                  <option value="">Todos</option>
                  <option value="asaas_auto">{SETTLEMENT_LABEL.asaas_auto}</option>
                  {SELECTABLE_SETTLEMENTS.map((t) => <option key={t} value={t}>{SETTLEMENT_LABEL[t]}</option>)}
                  <option value="import">{SETTLEMENT_LABEL.import}</option>
                </select>
              </label>
            ) : null}
            <label className="text-xs text-sand-dark">Ordenar por
              <select
                value={sortVal}
                onChange={(e) => {
                  const next = e.target.value as AccountsSort;
                  setSortVal(next);
                  apply(next);
                }}
                className={`mt-1 ${inputClass}`}
              >
                {(['nenhuma', 'referencia', 'data', 'nome'] as const).map((s) => <option key={s} value={s}>{sortLabel(s)}</option>)}
              </select>
            </label>
            <label className={`flex items-end gap-2 pb-2.5 text-xs ${canGroup ? 'text-sand-dark' : 'text-sand-dark/40'}`} title={canGroup ? undefined : 'Subtotais só nas ordens Referência e Nome'}>
              <input
                type="checkbox"
                checked={subVal && canGroup}
                disabled={!canGroup}
                onChange={(e) => {
                  setSubVal(e.target.checked);
                  apply(sortVal, e.target.checked);
                }}
                className="h-4 w-4 accent-gold"
              />
              Subtotais
            </label>
            <div className="flex items-end">
              <button onClick={() => apply()} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
                Filtrar
              </button>
            </div>
          </div>
        </section>

        <section className="rpt-noprint grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Lançamentos</p>
            <p className="mt-2 text-xl font-semibold text-sand-light">{report.rows.length}</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Total do período</p>
            <p className="mt-2 text-xl font-semibold text-gold">{brl(report.total)}</p>
          </div>
        </section>

        <ReportActions csv={() => ({ filename: `${basePath.split('/').pop()}_${from || 'inicio'}_${to || 'hoje'}`, rows: csvRows })}>
          <a href={xlsHref} className="rounded-full border border-gold/40 px-5 py-2.5 text-sm font-medium text-gold/90 transition-colors hover:border-gold/60 hover:text-gold">
            Baixar XLS
          </a>
        </ReportActions>

        <ReportDocument lodgeName={lodgeName} crestUrl={crestUrl} title={title} details={details} issuedBy={issuedBy} orientation="landscape">
          {report.rows.length === 0 ? (
            <EmptyState title="Nenhum lançamento no período." description="Ajuste os filtros acima para ver outro intervalo." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                    <th className="border-b border-white/10 px-2 py-2">{dateLabel}</th>
                    <th className="border-b border-white/10 px-2 py-2">Nome</th>
                    <th className="border-b border-white/10 px-2 py-2">Referência</th>
                    <th className="border-b border-white/10 px-2 py-2">Categoria</th>
                    {showSettlement ? <th className="border-b border-white/10 px-2 py-2">Tipo de baixa</th> : null}
                    <th className="border-b border-white/10 px-2 py-2 text-right num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {report.groups
                    ? report.groups.map((g, i) => (
                        <Fragment key={`${i}-${g.label}`}>
                          <tr className="rpt-group">
                            <td colSpan={cols} className="border-b border-gold/25 px-2 pb-1.5 pt-5 text-xs font-semibold uppercase tracking-[0.12em] text-gold/90">
                              {g.label}
                            </td>
                          </tr>
                          {g.rows.map(renderRow)}
                          <tr className="rpt-subtotal">
                            <td colSpan={cols - 1} className="px-2 py-2 text-right text-xs text-sand-dark">
                              Subtotal — {g.label} · {g.rows.length} lançamento{g.rows.length !== 1 ? 's' : ''}
                            </td>
                            <td className="px-2 py-2 text-right num tabular-nums font-medium text-sand-light">{brl(g.total)}</td>
                          </tr>
                        </Fragment>
                      ))
                    : report.rows.map(renderRow)}
                  <tr className="rpt-total">
                    <td className="px-2 py-2 font-semibold text-sand-light" colSpan={cols - 1}>Total — {report.rows.length} lançamento{report.rows.length !== 1 ? 's' : ''}</td>
                    <td className="px-2 py-2 text-right num font-semibold text-gold">{brl(report.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </ReportDocument>
      </div>
    </main>
  );
}
