'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, inputClass } from '@/components/ui';
import { ReportActions, ReportDocument } from '@/components/report/report-document';
import { brl } from '@/lib/currency';
import { csvNumber } from '@/lib/csv';
import { formatDateOnly } from '@/lib/date-only';
import { paymentMethodLabel, type PaymentHistory } from '@/lib/payment-history';

// Histórico de pagamentos — mesma tela para a loja (Tesoureiro/Admin/Venerável, todos os
// irmãos, com filtro por irmão) e para o irmão (portal, só o dele). Filtros vão na URL,
// como nos demais relatórios, para o link e o PDF refletirem o recorte.

function fmtPaidAt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export default function HistoricoPagamentosClient({
  mode,
  basePath,
  lodgeName,
  crestUrl,
  issuedBy,
  members = [],
  from,
  to,
  memberId = '',
  memberName = null,
  report,
}: {
  mode: 'staff' | 'member';
  basePath: string;
  lodgeName: string;
  crestUrl: string | null;
  issuedBy?: string | null;
  members?: { id: string; name: string }[];
  from: string;
  to: string;
  memberId?: string;
  /** Nome do irmão (modo irmão, ou o filtrado no modo loja). */
  memberName?: string | null;
  report: PaymentHistory;
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const [memberVal, setMemberVal] = useState(memberId);
  const staff = mode === 'staff';

  function go(next: { from?: string; to?: string; memberId?: string }) {
    const params = new URLSearchParams();
    const f = next.from ?? fromVal;
    const t = next.to ?? toVal;
    const m = next.memberId ?? memberVal;
    if (f) params.set('from', f);
    if (t) params.set('to', t);
    if (staff && m) params.set('memberId', m);
    router.push(`${basePath}?${params.toString()}`);
  }

  const title = staff ? 'Histórico de pagamentos' : 'Meu histórico de pagamentos';
  const period = `Período: ${from ? formatDateOnly(from) : 'início'} a ${to ? formatDateOnly(to) : 'hoje'}`;
  const details = [period, memberName ? `Irmão: ${memberName}` : staff ? 'Todos os irmãos' : null];
  const showMemberColumn = staff && !memberId;

  const csvRows = [
    ['Data do pagamento', ...(showMemberColumn ? ['Irmão'] : []), 'Referente a', 'Categoria', 'Vencimento', 'Forma', 'Valor'],
    ...report.rows.map((r) => [
      fmtPaidAt(r.paidAt), ...(showMemberColumn ? [r.memberName ?? ''] : []), r.title, r.category ?? '',
      r.dueDate ? formatDateOnly(r.dueDate) : '', paymentMethodLabel(r.method), csvNumber(r.amount),
    ]),
    ['Total', ...(showMemberColumn ? [''] : []), '', '', '', '', csvNumber(report.total)],
  ];

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rpt-noprint">
          {!staff ? (
            <Link href="/dashboard/portal" className="text-xs text-gold hover:text-gold-light">← Voltar ao meu portal</Link>
          ) : null}
          <h1 className="mt-1 font-display text-2xl font-bold text-sand-light">{title}</h1>
          <p className="mt-1 text-sm text-sand-dark">
            {staff
              ? 'Tudo o que os irmãos pagaram à loja, pela data do pagamento, com a forma e o recibo de cada lançamento.'
              : 'Tudo o que você já pagou à loja, pela data do pagamento. Cada linha tem o recibo emitido pela Tesouraria.'}
          </p>
        </div>

        <section className="rpt-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
          <form
            className={`grid gap-4 ${staff ? 'md:grid-cols-[1fr_1fr_1.6fr_auto]' : 'md:grid-cols-[1fr_1fr_auto]'}`}
            onSubmit={(e) => { e.preventDefault(); go({}); }}
          >
            <label className="text-xs text-sand-dark">De
              <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            {staff ? (
              <label className="text-xs text-sand-dark">Irmão
                <select value={memberVal} onChange={(e) => setMemberVal(e.target.value)} className={`mt-1 ${inputClass}`}>
                  <option value="">Todos os irmãos</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            ) : null}
            <div className="flex items-end">
              <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
                Filtrar
              </button>
            </div>
          </form>
        </section>

        <section className="rpt-noprint grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Pagamentos</p>
            <p className="mt-2 text-xl font-semibold text-sand-light">{report.rows.length}</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Total pago no período</p>
            <p className="mt-2 text-xl font-semibold text-gold">{brl(report.total)}</p>
          </div>
        </section>

        <ReportActions
          disabled={report.rows.length === 0}
          csv={() => ({ filename: `historico-pagamentos_${from || 'inicio'}_${to || 'hoje'}`, rows: csvRows })}
        />

        {showMemberColumn && report.byMember.length > 0 ? (
          <section className="rpt-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Por irmão</h2>
            <p className="mt-0.5 text-xs text-sand-dark">Clique no nome para ver só o histórico dele.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                    <th className="border-b border-white/10 px-2 py-2">Irmão</th>
                    <th className="border-b border-white/10 px-2 py-2 text-right">Pagamentos</th>
                    <th className="border-b border-white/10 px-2 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byMember.map((m) => (
                    <tr key={m.memberId}>
                      <td className="border-b border-white/5 px-2 py-2">
                        <button type="button" onClick={() => { setMemberVal(m.memberId); go({ memberId: m.memberId }); }} className="text-left text-gold hover:text-gold-light">
                          {m.memberName}
                        </button>
                      </td>
                      <td className="border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand">{m.count}</td>
                      <td className="border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand-light">{brl(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <ReportDocument lodgeName={lodgeName} crestUrl={crestUrl} title={title} details={details} issuedBy={issuedBy} orientation="landscape">
          {report.rows.length === 0 ? (
            <EmptyState title="Nenhum pagamento no período." description="Ajuste as datas acima para ver outro intervalo." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                    <th className="border-b border-white/10 px-2 py-2">Pago em</th>
                    {showMemberColumn ? <th className="border-b border-white/10 px-2 py-2">Irmão</th> : null}
                    <th className="border-b border-white/10 px-2 py-2">Referente a</th>
                    <th className="border-b border-white/10 px-2 py-2">Vencimento</th>
                    <th className="border-b border-white/10 px-2 py-2">Forma</th>
                    <th className="border-b border-white/10 px-2 py-2 text-right num">Valor</th>
                    <th className="rpt-noprint border-b border-white/10 px-2 py-2"><span className="sr-only">Recibo</span></th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="border-b border-white/5 px-2 py-2 text-sand">{fmtPaidAt(r.paidAt)}</td>
                      {showMemberColumn ? <td className="border-b border-white/5 px-2 py-2 text-sand">{r.memberName ?? '—'}</td> : null}
                      <td className="border-b border-white/5 px-2 py-2 text-sand">
                        {r.title}
                        {r.category && r.category !== r.title ? <span className="block text-xs text-sand-dark">{r.category}</span> : null}
                      </td>
                      <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{r.dueDate ? formatDateOnly(r.dueDate) : '—'}</td>
                      <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{paymentMethodLabel(r.method)}</td>
                      <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-sand-light">{brl(r.amount)}</td>
                      <td className="rpt-noprint border-b border-white/5 px-2 py-2 text-right">
                        <a href={`/dashboard/pagamentos/${r.id}/recibo`} target="_blank" rel="noreferrer" className="text-xs text-gold hover:text-gold-light">Recibo</a>
                      </td>
                    </tr>
                  ))}
                  <tr className="rpt-total">
                    <td className="px-2 py-2 font-semibold text-sand-light" colSpan={showMemberColumn ? 5 : 4}>
                      Total — {report.rows.length} pagamento{report.rows.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-2 py-2 text-right num font-semibold text-gold">{brl(report.total)}</td>
                    <td className="rpt-noprint" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {!staff ? (
            <p className="mt-4 text-xs text-sand-dark">Documento informativo, gerado pelo próprio irmão no portal. O comprovante oficial de cada pagamento é o recibo da Tesouraria.</p>
          ) : null}
        </ReportDocument>
      </div>
    </main>
  );
}
