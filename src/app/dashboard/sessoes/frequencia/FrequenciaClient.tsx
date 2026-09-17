'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, inputClass } from '@/components/ui';

interface MemberAttendanceStat {
  memberId: string;
  memberName: string;
  totalSessions: number;
  present: number;
  absent: number;
  unmarked: number;
  attendanceRate: number;
  consecutiveAbsences: number;
}

interface SessionAttendanceSummary {
  sessionId: string;
  title: string;
  date: string;
  type: string;
  present: number;
  absent: number;
  unmarked: number;
  total: number;
}

const TYPE_LABEL: Record<string, string> = { ordinary: 'Ordinária', magnificent: 'Magnífica', emergency: 'Extraordinária', other: 'Outra' };

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 16mm 14mm; }
  body * { visibility: hidden !important; }
  .freq-print, .freq-print * { visibility: visible !important; }
  .freq-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; font-size: 9.5pt; }
  .freq-noprint { display: none !important; }
  .freq-print h1, .freq-print h2 { color: #111 !important; }
  .freq-print table { width: 100%; border-collapse: collapse; }
  .freq-print th, .freq-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; text-align: left; }
  .freq-print th { text-transform: uppercase; font-size: 8pt; border-bottom: 1.5px solid #333; }
  .freq-print .num { text-align: right; }
  .freq-print tr { break-inside: avoid; page-break-inside: avoid; }
  .freq-print .pagebreak { break-before: page; page-break-before: always; }
}
`;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}
function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

export default function FrequenciaClient({
  lodgeName,
  crestUrl,
  from,
  to,
  report,
}: {
  lodgeName: string;
  crestUrl: string | null;
  from: string;
  to: string;
  report: { members: MemberAttendanceStat[]; sessions: SessionAttendanceSummary[] };
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);

  function applyWith(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams();
    if (nextFrom) params.set('from', nextFrom);
    if (nextTo) params.set('to', nextTo);
    router.push(`/dashboard/sessoes/frequencia?${params.toString()}`);
  }

  function apply() {
    applyWith(fromVal, toVal);
  }

  function shortcut(kind: 'ano-atual' | 'ultimos-6m' | 'ultimos-12m' | 'todas') {
    const now = new Date();
    let f: Date;
    const t = now;
    if (kind === 'ano-atual') f = new Date(now.getFullYear(), 0, 1);
    else if (kind === 'ultimos-6m') f = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    else if (kind === 'ultimos-12m') f = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
    else f = new Date(2000, 0, 1);
    const fStr = f.toISOString().slice(0, 10);
    const tStr = t.toISOString().slice(0, 10);
    setFromVal(fStr);
    setToVal(tStr);
    applyWith(fStr, tStr);
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="freq-noprint">
          <Link href="/dashboard/sessoes" className="text-xs text-gold/70 transition hover:text-gold">&larr; Voltar às sessões</Link>
          <h1 className="mt-2 font-display text-2xl font-bold text-sand-light">Frequência às sessões</h1>
          <p className="mt-1 text-sm text-sand-dark">Presença dos obreiros ativos no período — quem falta seguido aparece primeiro na lista.</p>
        </div>

        <section className="freq-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs text-sand-dark">De
              <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <div className="flex items-end">
              <button onClick={apply} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
                Aplicar
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => shortcut('ano-atual')} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">Ano atual</button>
            <button onClick={() => shortcut('ultimos-6m')} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">Últimos 6 meses</button>
            <button onClick={() => shortcut('ultimos-12m')} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">Últimos 12 meses</button>
            <button onClick={() => shortcut('todas')} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">Todas as sessões</button>
          </div>
        </section>

        {report.sessions.length === 0 ? (
          <EmptyState title="Nenhuma sessão registrada neste período." description="Cadastre sessões e marque presença em Sessões para ver a frequência aqui." />
        ) : (
          <>
            <div className="freq-noprint">
              <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">
                Salvar como PDF
              </button>
            </div>

            <section className="rounded-xl border border-white/6 bg-sigma-card p-6 freq-print">
              <header className="mb-5 text-center">
                {crestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
                ) : null}
                <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
                <h2 className="mt-0.5 text-sm text-sand-dark">Frequência às sessões — obreiros ativos</h2>
                <p className="mt-0.5 text-xs text-sand-dark">Período: {fmtDate(`${fromVal}T00:00:00`)} a {fmtDate(`${toVal}T00:00:00`)} · {report.sessions.length} sessão(ões)</p>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                      <th className="border-b border-white/10 px-2 py-2">Obreiro</th>
                      <th className="border-b border-white/10 px-2 py-2 text-right num">Presenças</th>
                      <th className="border-b border-white/10 px-2 py-2 text-right num">Faltas</th>
                      <th className="border-b border-white/10 px-2 py-2 text-right num">Não registrada</th>
                      <th className="border-b border-white/10 px-2 py-2 text-right num">Frequência</th>
                      <th className="border-b border-white/10 px-2 py-2 text-right num">Faltas seguidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.members.map((m) => (
                      <tr key={m.memberId}>
                        <td className="border-b border-white/5 px-2 py-2 text-sand-light">{m.memberName}</td>
                        <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-emerald-300">{m.present}</td>
                        <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-rose-300">{m.absent}</td>
                        <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-sand-dark">{m.unmarked}</td>
                        <td className={`border-b border-white/5 px-2 py-2 text-right num tabular-nums font-medium ${m.attendanceRate < 0.5 ? 'text-rose-300' : 'text-sand-light'}`}>
                          {m.totalSessions > 0 ? pct(m.attendanceRate) : '—'}
                        </td>
                        <td className={`border-b border-white/5 px-2 py-2 text-right num tabular-nums ${m.consecutiveAbsences >= 3 ? 'font-semibold text-rose-300' : 'text-sand-dark'}`}>
                          {m.consecutiveAbsences > 0 ? m.consecutiveAbsences : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-white/6 bg-sigma-card p-6 freq-print pagebreak">
              <h2 className="mb-4 text-base font-semibold text-sand-light">Sessões do período</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-sand-dark/70">
                      <th className="border-b border-white/10 px-2 py-2">Data</th>
                      <th className="border-b border-white/10 px-2 py-2">Sessão</th>
                      <th className="border-b border-white/10 px-2 py-2">Tipo</th>
                      <th className="border-b border-white/10 px-2 py-2 text-right num">Presentes</th>
                      <th className="border-b border-white/10 px-2 py-2 text-right num">Ausentes</th>
                      <th className="border-b border-white/10 px-2 py-2 text-right num">Não registrada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sessions.map((s) => (
                      <tr key={s.sessionId}>
                        <td className="border-b border-white/5 px-2 py-2 text-sand">{fmtDate(s.date)}</td>
                        <td className="border-b border-white/5 px-2 py-2 text-sand-light">{s.title}</td>
                        <td className="border-b border-white/5 px-2 py-2 text-sand-dark">{TYPE_LABEL[s.type] ?? s.type}</td>
                        <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-emerald-300">{s.present}</td>
                        <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-rose-300">{s.absent}</td>
                        <td className="border-b border-white/5 px-2 py-2 text-right num tabular-nums text-sand-dark">{s.unmarked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
