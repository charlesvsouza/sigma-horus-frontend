'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, inputClass } from '@/components/ui';
import { ReportActions, ReportDocument } from '@/components/report/report-document';
import { AUDIT_REPORT_LIMIT, actionLabel, entityLabel, type AuditReport } from '@/lib/audit-report';
import { formatDateOnly } from '@/lib/date-only';

// Relatório de intervenções: período manual (de/até) e filtro por "quem". Os filtros vão na URL
// para o link e o PDF refletirem o recorte, como nos demais relatórios.

const fmtAt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export default function AuditReportClient({
  lodgeName, crestUrl, issuedBy, users, from, to, actor, truncated, report,
}: {
  lodgeName: string;
  crestUrl: string | null;
  issuedBy: string | null;
  users: { id: string; name: string }[];
  from: string;
  to: string;
  actor: string;
  truncated: boolean;
  report: AuditReport;
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const [actorVal, setActorVal] = useState(actor);

  function go() {
    const params = new URLSearchParams();
    if (fromVal) params.set('from', fromVal);
    if (toVal) params.set('to', toVal);
    if (actorVal) params.set('actor', actorVal);
    router.push(`/dashboard/auditoria/relatorio?${params.toString()}`);
  }

  const actorName = actor ? users.find((u) => u.id === actor)?.name ?? 'Sistema' : null;
  const details = [
    `Período: ${from ? formatDateOnly(from) : 'início'} a ${to ? formatDateOnly(to) : 'hoje'}`,
    actorName ? `Quem: ${actorName}` : 'Todas as pessoas',
    `${report.total} intervenç${report.total === 1 ? 'ão' : 'ões'}`,
  ];

  const csvRows = [
    ['Quem', 'Data e hora', 'Ação', 'Item', 'Registro', 'Detalhes', 'Feito pelo suporte'],
    ...report.actors.flatMap((a) => a.rows.map((r) => [a.name, fmtAt(r.at), actionLabel(r.action), entityLabel(r.entity), r.entityId, r.detail, r.viaSuperadmin ? 'sim' : ''])),
  ];

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rpt-noprint">
          <Link href="/dashboard/auditoria" className="text-xs text-gold hover:text-gold-light">← Voltar à Auditoria</Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-sand-light">Relatório de intervenções</h1>
          <p className="mt-1 text-sm text-sand-dark">O que cada pessoa fez no sistema no período escolhido: criações, alterações e remoções, agrupadas por quem as fez.</p>
        </div>

        <section className="rpt-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
          <form className="grid gap-4 md:grid-cols-[1fr_1fr_1.6fr_auto]" onSubmit={(e) => { e.preventDefault(); go(); }}>
            <label className="text-xs text-sand-dark">De
              <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Quem
              <select value={actorVal} onChange={(e) => setActorVal(e.target.value)} className={`mt-1 ${inputClass}`}>
                <option value="">Todas as pessoas</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                <option value="system">Sistema (webhooks e rotinas)</option>
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Emitir</button>
            </div>
          </form>
        </section>

        {truncated ? (
          <p role="alert" className="rpt-noprint rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            O período tem mais de {AUDIT_REPORT_LIMIT} intervenções; o relatório mostra as {AUDIT_REPORT_LIMIT} mais recentes. Reduza o período ou escolha uma pessoa para ver tudo.
          </p>
        ) : null}

        <ReportActions disabled={report.total === 0} csv={() => ({ filename: `intervencoes_${from || 'inicio'}_${to || 'hoje'}`, rows: csvRows })} />

        <ReportDocument lodgeName={lodgeName} crestUrl={crestUrl} title="Relatório de intervenções" details={details} issuedBy={issuedBy} orientation="landscape">
          {report.total === 0 ? (
            <EmptyState title="Nenhuma intervenção no período." description="Ajuste as datas ou a pessoa para ver outro recorte." />
          ) : (
            <div className="space-y-6">
              <table className="rpt-section w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                    <th className="border-b border-white/10 px-2 py-2">Quem</th>
                    <th className="num border-b border-white/10 px-2 py-2 text-right">Criações</th>
                    <th className="num border-b border-white/10 px-2 py-2 text-right">Alterações</th>
                    <th className="num border-b border-white/10 px-2 py-2 text-right">Remoções</th>
                    <th className="num border-b border-white/10 px-2 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.actors.map((a) => (
                    <tr key={a.key}>
                      <td className="border-b border-white/5 px-2 py-2 text-sand">{a.name}</td>
                      <td className="num border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand-dark">{a.byAction.CREATE ?? 0}</td>
                      <td className="num border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand-dark">{a.byAction.UPDATE ?? 0}</td>
                      <td className="num border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand-dark">{a.byAction.DELETE ?? 0}</td>
                      <td className="num border-b border-white/5 px-2 py-2 text-right tabular-nums text-sand-light">{a.total}</td>
                    </tr>
                  ))}
                  <tr className="rpt-total">
                    <td className="px-2 py-2 font-semibold text-sand-light">Total</td>
                    <td className="num px-2 py-2 text-right tabular-nums">{report.byAction.CREATE ?? 0}</td>
                    <td className="num px-2 py-2 text-right tabular-nums">{report.byAction.UPDATE ?? 0}</td>
                    <td className="num px-2 py-2 text-right tabular-nums">{report.byAction.DELETE ?? 0}</td>
                    <td className="num px-2 py-2 text-right font-semibold tabular-nums text-sand-light">{report.total}</td>
                  </tr>
                </tbody>
              </table>

              {report.actors.map((a) => (
                <section key={a.key} className="rpt-section">
                  <h2 className="border-b border-gold/25 pb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-gold/90">
                    {a.name} · {a.total} intervenç{a.total === 1 ? 'ão' : 'ões'}
                  </h2>
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                        <th className="border-b border-white/10 px-2 py-2">Data e hora</th>
                        <th className="border-b border-white/10 px-2 py-2">Ação</th>
                        <th className="border-b border-white/10 px-2 py-2">Item</th>
                        <th className="border-b border-white/10 px-2 py-2">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.rows.map((r) => (
                        <tr key={r.id}>
                          <td className="whitespace-nowrap border-b border-white/5 px-2 py-1.5 text-sand-dark">{fmtAt(r.at)}</td>
                          <td className="border-b border-white/5 px-2 py-1.5 text-sand">{actionLabel(r.action)}</td>
                          <td className="border-b border-white/5 px-2 py-1.5 text-sand">{entityLabel(r.entity)}</td>
                          <td className="border-b border-white/5 px-2 py-1.5 text-xs text-sand-dark">
                            {r.detail || '—'}
                            {r.viaSuperadmin ? <span className="ml-2 text-amber-300">(feito pelo suporte)</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          )}
        </ReportDocument>
      </div>
    </main>
  );
}
