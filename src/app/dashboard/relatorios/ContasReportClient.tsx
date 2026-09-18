'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';

interface PersonOption { id: string; name: string; }
interface ReportRow { id: string; date: string; personId: string | null; personName: string | null; description: string; category: string | null; amount: number; }

const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 16mm 14mm; }
  body * { visibility: hidden !important; }
  .cr-print, .cr-print * { visibility: visible !important; }
  .cr-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 9.5pt; }
  .cr-noprint { display: none !important; }
  .cr-print h1, .cr-print h2 { color: #111 !important; }
  .cr-print table { width: 100%; border-collapse: collapse; }
  .cr-print th, .cr-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; text-align: left; }
  .cr-print th { text-transform: uppercase; font-size: 8pt; border-bottom: 1.5px solid #333; }
  .cr-print .num { text-align: right; }
  .cr-print tr { break-inside: avoid; page-break-inside: avoid; }
}
`;

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

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="cr-noprint">
          <h1 className="font-display text-2xl font-bold text-sand-light">{title}</h1>
          <p className="mt-1 text-sm text-sand-dark">{description}</p>
        </div>

        <section className="cr-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
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

        <section className="cr-noprint grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Lançamentos</p>
            <p className="mt-2 text-xl font-semibold text-sand-light">{report.rows.length}</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Total do período</p>
            <p className="mt-2 text-xl font-semibold text-gold">{brl(report.total)}</p>
          </div>
        </section>

        <div className="cr-noprint flex flex-wrap gap-3">
          <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
            Salvar como PDF
          </button>
          <a href={xlsHref} className="rounded-full border border-gold/40 px-5 py-2.5 text-sm font-medium text-gold/90 transition-colors hover:border-gold/60 hover:text-gold">
            Baixar XLS
          </a>
        </div>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6 cr-print">
          <header className="mb-5 text-center">
            {crestUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
            ) : null}
            <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
            <h2 className="mt-0.5 text-sm text-sand-dark">{title}</h2>
            <p className="mt-0.5 text-xs text-sand-dark">Período: {fmtDate(`${fromVal}T00:00:00`)} a {fmtDate(`${toVal}T00:00:00`)}</p>
          </header>

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
                  <tr>
                    <td className="px-2 py-2 font-semibold text-sand-light" colSpan={4}>Total do período</td>
                    <td className="px-2 py-2 text-right num font-semibold text-gold">{brl(report.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
