'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, inputClass } from '@/components/ui';
import { ReportActions, ReportDocument } from '@/components/report/report-document';
import { brl } from '@/lib/currency';
import { csvNumber } from '@/lib/csv';

interface PersonOption { id: string; name: string; }
interface ReportRow { id: string; date: string; personId: string | null; personName: string | null; description: string; category: string | null; amount: number; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
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
  report: { rows: ReportRow[]; total: number };
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const [personVal, setPersonVal] = useState(personId);
  const [textVal, setTextVal] = useState(text);

  function apply() {
    const params = new URLSearchParams();
    if (fromVal) params.set('from', fromVal);
    if (toVal) params.set('to', toVal);
    if (personVal) params.set('personId', personVal);
    if (textVal) params.set('text', textVal);
    router.push(`${basePath}?${params.toString()}`);
  }

  const xlsHref = `/api/reports/accounts/xlsx?variant=${basePath.split('/').pop()}&from=${fromVal}&to=${toVal}${personVal ? `&personId=${personVal}` : ''}${textVal ? `&text=${encodeURIComponent(textVal)}` : ''}`;

  // Contas em aberto sem datas no filtro = todas as pendências (não "Invalid Date").
  const period = from || to
    ? `Período: ${from ? fmtDate(`${from}T00:00:00`) : 'início'} a ${to ? fmtDate(`${to}T00:00:00`) : 'hoje'}`
    : 'Todas as pendências, sem limite de data';
  const personName = personId ? people.find((p) => p.id === personId)?.name : null;
  const details = [period, personName ? `Pessoa: ${personName}` : null, text ? `Busca: "${text}"` : null];
  const csvRows = [
    [dateLabel, 'Nome', 'Descrição', 'Categoria', 'Valor'],
    ...report.rows.map((r) => [fmtDate(r.date), r.personName ?? '', r.description, r.category ?? '', csvNumber(r.amount)]),
    ['Total', '', '', '', csvNumber(report.total)],
  ];

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rpt-noprint">
          <h1 className="font-display text-2xl font-bold text-sand-light">{title}</h1>
          <p className="mt-1 text-sm text-sand-dark">{description}</p>
        </div>

        <section className="rpt-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.4fr_1.4fr_auto]">
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
            <label className="text-xs text-sand-dark">Descrição ou categoria
              <input value={textVal} onChange={(e) => setTextVal(e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Buscar…" />
            </label>
            <div className="flex items-end">
              <button onClick={apply} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
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
                    <th className="border-b border-white/10 px-2 py-2">Descrição</th>
                    <th className="border-b border-white/10 px-2 py-2">Categoria</th>
                    <th className="border-b border-white/10 px-2 py-2 text-right num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="border-b border-white/5 px-2 py-2 text-sand">{fmtDate(r.date)}</td>
                      <td className="border-b border-white/5 px-2 py-2 text-sand">{r.personName ?? '—'}</td>
                      <td className="border-b border-white/5 px-2 py-2 text-sand">{r.description}</td>
                      <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{r.category ?? '—'}</td>
                      <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-sand-light">{brl(r.amount)}</td>
                    </tr>
                  ))}
                  <tr className="rpt-total">
                    <td className="px-2 py-2 font-semibold text-sand-light" colSpan={4}>Total — {report.rows.length} lançamento{report.rows.length !== 1 ? 's' : ''}</td>
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
