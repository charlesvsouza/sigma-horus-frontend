"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';
import type { FundPurpose } from '@/lib/funds';
import ContributionForm from './ContributionForm';

interface Bucket { label: string; total: number; count: number }
interface Report {
  statement: {
    openingBalance: number;
    closingBalance: number;
    totalIn: number;
    totalOut: number;
    movements: { date: string; kind: string; description: string; reference: string | null; amount: number; signedAmount: number; balance: number }[];
  };
  balanceNow: number;
  entriesByOrigin: { campaign: number; session: number; other: number };
  entryDetail: (Bucket & { origin: string })[];
  exitsByTitle: Bucket[];
  donors: Bucket[];
  monthly: { month: string; in: number; out: number; net: number }[];
}
interface CampaignRow { id: string; title: string; status: string; goal: number | null; donated: number; donatedInPeriod: number; fundAllocated: number }

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .fundo-print, .fundo-print * { visibility: visible !important; }
  .fundo-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif; }
  .fundo-noprint { display: none !important; }
  .fundo-print h1, .fundo-print h2, .fundo-print h3 { color: #111 !important; }
  .fundo-print table { width: 100%; border-collapse: collapse; }
  .fundo-print th, .fundo-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; text-align: left; color: #111 !important; }
  .fundo-print th { text-transform: uppercase; font-size: 8pt; border-bottom: 1.5px solid #333; }
  .fundo-print .num { text-align: right; }
  .fundo-print tr { break-inside: avoid; page-break-inside: avoid; }
  .fundo-print .card { border: 1px solid #ccc !important; background: #fff !important; }
  .fundo-print .card * { color: #111 !important; }
}
`;

const BR = 'America/Sao_Paulo';
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: BR });
const fmtMonth = (ym: string) => `${ym.slice(5)}/${ym.slice(0, 4)}`;
const KIND_LABEL: Record<string, string> = { payment_in: 'Entrada', payment_out: 'Saída', transfer_in: 'Transf. recebida', transfer_out: 'Transf. enviada' };
const STATUS_LABEL: Record<string, string> = { active: 'Ativa', completed: 'Concluída', canceled: 'Cancelada' };
const ORIGIN_LABEL: Record<string, string> = { campaign: 'Campanha', session: 'Sessão' };

const CARD = 'card rounded-xl border border-white/6 bg-sigma-card p-5';
const TH = 'border-b border-white/10 px-2 py-2 text-left text-xs uppercase tracking-wide text-sand-dark/70';
const TD = 'border-b border-white/5 px-2 py-2';

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'in' | 'out' | 'gold' }) {
  const color = tone === 'in' ? 'text-emerald-300' : tone === 'out' ? 'text-rose-300' : tone === 'gold' ? 'text-gold' : 'text-sand-light';
  return (
    <div className={CARD}>
      <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function BucketTable({ rows, empty, head }: { rows: Bucket[]; empty: string; head: [string, string] }) {
  if (rows.length === 0) return <p className="text-sm text-sand-dark">{empty}</p>;
  return (
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead>
        <tr>
          <th className={TH}>{head[0]}</th>
          <th className={`${TH} num text-right`}>Lançamentos</th>
          <th className={`${TH} num text-right`}>{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td className={`${TD} text-sand`}>{r.label}</td>
            <td className={`${TD} num text-right tabular-nums text-sand-dark`}>{r.count}</td>
            <td className={`${TD} num text-right tabular-nums text-sand-light`}>{brl(r.total)}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

export default function FundosClient({
  fund, fundLabels, lodgeName, crestUrl, from, to, accounts, report, campaigns, canSeeDonors, canRecord, members, sessions,
}: {
  fund: FundPurpose;
  fundLabels: Record<FundPurpose, string>;
  lodgeName: string;
  crestUrl: string | null;
  from: string;
  to: string;
  accounts: { id: string; name: string; isDefault: boolean }[];
  report: Report;
  campaigns: CampaignRow[];
  canSeeDonors: boolean;
  canRecord: boolean;
  members: { id: string; name: string }[];
  sessions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const [showContribution, setShowContribution] = useState(false);

  const go = (f: string, t: string, fu: FundPurpose = fund) => router.push(`/dashboard/hospitalaria/fundos?fund=${fu}&from=${f}&to=${t}`);
  const today = new Date();
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const shortcut = (k: 'mes' | 'ano' | 'tudo') => {
    const y = today.getFullYear();
    const m = today.getMonth();
    const range = k === 'mes' ? [ymd(new Date(Date.UTC(y, m, 1))), ymd(today)] : k === 'ano' ? [`${y}-01-01`, ymd(today)] : ['2000-01-01', ymd(today)];
    setFromVal(range[0]);
    setToVal(range[1]);
    go(range[0], range[1]);
  };

  const st = report.statement;
  const totalEntries = report.entriesByOrigin.campaign + report.entriesByOrigin.session + report.entriesByOrigin.other;
  const isTronco = fund === 'tronco';

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="fundo-noprint">
          <h1 className="font-display text-2xl font-bold text-sand-light">Fundos da loja</h1>
          <p className="mt-1 text-sm text-sand-dark">Gestão do Tronco de Beneficência e das Doações e Contribuições. São categorias do plano de contas: o dinheiro entra e sai pelos bancos e caixa da loja, e aqui aparece tudo o que foi lançado nelas.</p>
        </div>

        <div className="fundo-noprint flex flex-wrap gap-2">
          {(['tronco', 'donations'] as FundPurpose[]).map((f) => (
            <Link
              key={f}
              href={`/dashboard/hospitalaria/fundos?fund=${f}&from=${fromVal}&to=${toVal}`}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${f === fund ? 'border-gold/60 bg-gold/10 text-gold' : 'border-white/8 text-sand-dark hover:border-white/20 hover:text-sand-light'}`}
            >
              {fundLabels[f]}
            </Link>
          ))}
        </div>

        <section className="fundo-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs text-sand-dark">De
              <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <div className="flex items-end">
              <Button type="button" variant="secondary" onClick={() => go(fromVal, toVal)}>Aplicar</Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {([['mes', 'Mês atual'], ['ano', 'Ano atual'], ['tudo', 'Desde o início']] as const).map(([k, label]) => (
              <button key={k} onClick={() => shortcut(k)} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">{label}</button>
            ))}
          </div>
        </section>

        {(
          <>
            <div className="fundo-noprint flex flex-wrap items-center gap-3">
              {canRecord ? (
                <Button type="button" onClick={() => setShowContribution((v) => !v)}>Registrar aporte</Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={() => window.print()}>Salvar como PDF</Button>
              <Link href={`/dashboard/relatorios/categorias?fund=${fund}&from=${fromVal}&to=${toVal}`} className="rounded-full border border-gold/40 px-5 py-2.5 text-sm font-medium text-gold/90 transition-colors hover:border-gold/60 hover:text-gold">Razão por categoria</Link>
            </div>

            {showContribution && canRecord ? (
              <ContributionForm
                key={fund}
                fund={fund}
                fundLabel={fundLabels[fund]}
                accounts={accounts}
                members={members}
                sessions={sessions}
                onClose={() => setShowContribution(false)}
              />
            ) : null}

            <div className="fundo-print space-y-8">
              <header className="text-center">
                {crestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
                ) : null}
                <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
                <h2 className="mt-0.5 text-sm text-sand-dark">Prestação de contas — {fundLabels[fund]}</h2>
                <p className="mt-0.5 text-xs text-sand-dark">Período: {fmtDate(`${from}T12:00:00Z`)} a {fmtDate(`${to}T12:00:00Z`)}</p>
              </header>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Stat label="Saldo hoje" value={brl(report.balanceNow)} tone="gold" />
                <Stat label="Saldo inicial do período" value={brl(st.openingBalance)} />
                <Stat label="Entradas" value={brl(st.totalIn)} tone="in" />
                <Stat label="Saídas" value={brl(st.totalOut)} tone="out" />
                <Stat label="Saldo final do período" value={brl(st.closingBalance)} tone="gold" />
              </section>

              <section className={CARD}>
                <h3 className="text-base font-semibold text-sand-light">Entradas por origem</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Stat label="Sessões (tronco passado)" value={brl(report.entriesByOrigin.session)} />
                  <Stat label="Campanhas" value={brl(report.entriesByOrigin.campaign)} />
                  <Stat label="Avulsas / outras" value={brl(report.entriesByOrigin.other)} />
                </div>
                <p className="mt-2 text-xs text-sand-dark">Total de entradas de pagamentos no período: {brl(totalEntries)}.</p>
                {report.entryDetail.length > 0 ? (
                  <div className="overflow-x-auto"><table className="mt-3 w-full text-sm">
                    <thead><tr><th className={TH}>Origem</th><th className={TH}>Detalhe</th><th className={`${TH} num text-right`}>Lançamentos</th><th className={`${TH} num text-right`}>Total</th></tr></thead>
                    <tbody>
                      {report.entryDetail.map((r) => (
                        <tr key={`${r.origin}-${r.label}`}>
                          <td className={`${TD} text-sand-dark`}>{ORIGIN_LABEL[r.origin] ?? r.origin}</td>
                          <td className={`${TD} text-sand`}>{r.label}</td>
                          <td className={`${TD} num text-right tabular-nums text-sand-dark`}>{r.count}</td>
                          <td className={`${TD} num text-right tabular-nums text-sand-light`}>{brl(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : null}
              </section>

              <section className={CARD}>
                <h3 className="text-base font-semibold text-sand-light">Saídas do período</h3>
                <div className="mt-3">
                  <BucketTable rows={report.exitsByTitle} empty="Nenhuma saída neste período." head={['Destino / finalidade', 'Total']} />
                </div>
              </section>

              <section className={CARD}>
                <h3 className="text-base font-semibold text-sand-light">Doadores</h3>
                {!canSeeDonors ? <p className="mt-1 text-xs text-sand-dark">Os nomes de quem doou ao Tronco só aparecem para Administrador, Venerável e Tesoureiro.</p> : null}
                <div className="mt-3">
                  <BucketTable rows={report.donors.slice(0, 15)} empty="Nenhuma entrada neste período." head={['Doador', 'Total']} />
                </div>
              </section>

              {isTronco ? (
                <section className={CARD}>
                  <h3 className="text-base font-semibold text-sand-light">Campanhas de benemerência</h3>
                  {campaigns.length === 0 ? (
                    <p className="mt-2 text-sm text-sand-dark">Nenhuma campanha cadastrada.</p>
                  ) : (
                    <div className="overflow-x-auto"><table className="mt-3 w-full text-sm">
                      <thead>
                        <tr>
                          <th className={TH}>Campanha</th><th className={TH}>Situação</th>
                          <th className={`${TH} num text-right`}>Meta</th>
                          <th className={`${TH} num text-right`}>Doações (total)</th>
                          <th className={`${TH} num text-right`}>Doações no período</th>
                          <th className={`${TH} num text-right`}>Custeado pelo Tronco</th>
                          <th className={`${TH} num text-right`}>% da meta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map((c) => {
                          const pct = c.goal && c.goal > 0 ? Math.round(((c.donated + c.fundAllocated) / c.goal) * 100) : null;
                          return (
                            <tr key={c.id}>
                              <td className={`${TD} text-sand`}>{c.title}</td>
                              <td className={`${TD} text-sand-dark`}>{STATUS_LABEL[c.status] ?? c.status}</td>
                              <td className={`${TD} num text-right tabular-nums text-sand-dark`}>{c.goal != null ? brl(c.goal) : '—'}</td>
                              <td className={`${TD} num text-right tabular-nums text-sand-light`}>{brl(c.donated)}</td>
                              <td className={`${TD} num text-right tabular-nums text-sand-light`}>{brl(c.donatedInPeriod)}</td>
                              <td className={`${TD} num text-right tabular-nums text-sand-light`}>{brl(c.fundAllocated)}</td>
                              <td className={`${TD} num text-right tabular-nums text-sand-dark`}>{pct != null ? `${pct}%` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table></div>
                  )}
                </section>
              ) : null}

              <section className={CARD}>
                <h3 className="text-base font-semibold text-sand-light">Evolução mensal (12 meses)</h3>
                <div className="overflow-x-auto"><table className="mt-3 w-full text-sm">
                  <thead><tr><th className={TH}>Mês</th><th className={`${TH} num text-right`}>Entradas</th><th className={`${TH} num text-right`}>Saídas</th><th className={`${TH} num text-right`}>Resultado</th></tr></thead>
                  <tbody>
                    {report.monthly.map((m) => (
                      <tr key={m.month}>
                        <td className={`${TD} text-sand`}>{fmtMonth(m.month)}</td>
                        <td className={`${TD} num text-right tabular-nums text-emerald-300`}>{brl(m.in)}</td>
                        <td className={`${TD} num text-right tabular-nums text-rose-300`}>{brl(m.out)}</td>
                        <td className={`${TD} num text-right tabular-nums ${m.net >= 0 ? 'text-sand-light' : 'text-rose-300'}`}>{brl(m.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </section>

              <section className={CARD}>
                <h3 className="text-base font-semibold text-sand-light">Extrato do período</h3>
                <div className="overflow-x-auto"><table className="mt-3 w-full text-sm">
                  <thead>
                    <tr><th className={TH}>Data</th><th className={TH}>Histórico</th><th className={TH}>Doador / obs.</th><th className={TH}>Tipo</th><th className={`${TH} num text-right`}>Valor</th><th className={`${TH} num text-right`}>Saldo</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={`${TD} text-sand-dark`} colSpan={5}>Saldo inicial do período</td>
                      <td className={`${TD} num text-right font-medium tabular-nums text-sand-light`}>{brl(st.openingBalance)}</td>
                    </tr>
                    {st.movements.length === 0 ? (
                      <tr><td className="px-2 py-4 text-sand-dark" colSpan={6}>Nenhuma movimentação neste período.</td></tr>
                    ) : st.movements.map((m, i) => (
                      <tr key={i}>
                        <td className={`${TD} text-sand`}>{fmtDate(m.date)}</td>
                        <td className={`${TD} text-sand`}>{m.description}</td>
                        <td className={`${TD} text-sand-dark`}>{m.reference ?? '—'}</td>
                        <td className={`${TD} text-sand-dark`}>{KIND_LABEL[m.kind] ?? m.kind}</td>
                        <td className={`${TD} num text-right tabular-nums ${m.signedAmount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{m.signedAmount >= 0 ? '+' : '−'}{brl(m.amount)}</td>
                        <td className={`${TD} num text-right tabular-nums text-sand-light`}>{brl(m.balance)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-2 py-2 font-semibold text-sand-light" colSpan={5}>Saldo final do período</td>
                      <td className="px-2 py-2 text-right num font-semibold tabular-nums text-gold">{brl(st.closingBalance)}</td>
                    </tr>
                  </tbody>
                </table></div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
