"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, inputClass } from '@/components/ui';
import { brl } from '@/lib/currency';

interface Bucket { key: string; count: number; gross: number; fee: number }
interface Row { id: string; date: string; invoiceNumber: string | null; memberName: string | null; method: string | null; gross: number; fee: number | null; passedOn: number }
interface Report {
  count: number; gross: number; fee: number; net: number; passedOn: number; absorbed: number;
  averageFee: number; feePercent: number; unknownFeeCount: number;
  outOfPolicy: Row[]; byMethod: Bucket[]; byMonth: Bucket[];
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .tarifa-print, .tarifa-print * { visibility: visible !important; }
  .tarifa-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif; }
  .tarifa-noprint { display: none !important; }
  .tarifa-print h1, .tarifa-print h2, .tarifa-print h3 { color: #111 !important; }
  .tarifa-print table { width: 100%; border-collapse: collapse; }
  .tarifa-print th, .tarifa-print td { border-bottom: 1px solid #ddd; padding: 3px 6px; text-align: left; color: #111 !important; }
  .tarifa-print th { text-transform: uppercase; font-size: 8pt; border-bottom: 1.5px solid #333; }
  .tarifa-print .num { text-align: right; }
  .tarifa-print .card { border: 1px solid #ccc !important; background: #fff !important; }
  .tarifa-print .card * { color: #111 !important; }
}
`;

const BR = 'America/Sao_Paulo';
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: BR });
const fmtMonth = (ym: string) => `${ym.slice(5)}/${ym.slice(0, 4)}`;
const METHOD_LABEL: Record<string, string> = { PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de crédito', DEBIT_CARD: 'Cartão de débito', TRANSFER: 'Transferência', DEPOSIT: 'Depósito' };
const methodLabel = (m: string | null) => (m ? METHOD_LABEL[m] ?? m : 'Não informado');

const CARD = 'card rounded-xl border border-white/6 bg-sigma-card p-5';
const TH = 'border-b border-white/10 px-2 py-2 text-left text-xs uppercase tracking-wide text-sand-dark/70';
const TD = 'border-b border-white/5 px-2 py-2';

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'out' | 'gold' | 'in'; hint?: string }) {
  const color = tone === 'out' ? 'text-rose-300' : tone === 'gold' ? 'text-gold' : tone === 'in' ? 'text-emerald-300' : 'text-sand-light';
  return (
    <div className={CARD}>
      <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-sand-dark">{hint}</p> : null}
    </div>
  );
}

export default function TarifasClient({ lodgeName, crestUrl, asaasMode, from, to, report, rows }: {
  lodgeName: string; crestUrl: string | null; asaasMode: boolean; from: string; to: string; report: Report; rows: Row[];
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const go = (f: string, t: string) => router.push(`/dashboard/relatorios/tarifas?from=${f}&to=${t}`);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const shortcut = (k: 'mes' | 'ano' | 'tudo') => {
    const now = new Date();
    const y = now.getFullYear();
    const r = k === 'mes' ? [ymd(new Date(Date.UTC(y, now.getMonth(), 1))), ymd(now)] : k === 'ano' ? [`${y}-01-01`, ymd(now)] : ['2000-01-01', ymd(now)];
    setFromVal(r[0]); setToVal(r[1]); go(r[0], r[1]);
  };

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="tarifa-noprint">
          <h1 className="font-display text-2xl font-bold text-sand-light">Tarifas de cobrança (Asaas)</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Quanto o Asaas cobrou de verdade em cada recebimento (valor cobrado − valor líquido informado por ele) e quanto a loja absorveu.
            A política atual é a loja <strong>absorver</strong> a tarifa.
          </p>
        </div>

        {!asaasMode ? (
          <div className="tarifa-noprint rounded-xl border border-white/8 bg-sigma-card p-4 text-sm text-sand-dark">
            A loja está no <strong>Modo Loja</strong> (recebimento direto na conta da loja): não há tarifas do Asaas. Se já usou o Asaas antes, o histórico continua abaixo.
          </div>
        ) : null}

        <section className="tarifa-noprint rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs text-sand-dark">De
              <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">Até
              <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <div className="flex items-end">
              <button onClick={() => go(fromVal, toVal)} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Aplicar</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {([['mes', 'Mês atual'], ['ano', 'Ano atual'], ['tudo', 'Desde o início']] as const).map(([k, label]) => (
              <button key={k} onClick={() => shortcut(k)} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">{label}</button>
            ))}
          </div>
        </section>

        {report.count === 0 ? (
          <EmptyState title="Nenhum recebimento pelo Asaas neste período." description="Os recebimentos baixados automaticamente pelo Asaas aparecem aqui, com a tarifa real de cada um." />
        ) : (
          <>
            <div className="tarifa-noprint">
              <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Salvar como PDF</button>
            </div>

            <div className="tarifa-print space-y-8">
              <header className="text-center">
                {crestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={crestUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
                ) : null}
                <h1 className="text-lg font-bold text-sand-light">{lodgeName}</h1>
                <h2 className="mt-0.5 text-sm text-sand-dark">Tarifas de cobrança (Asaas)</h2>
                <p className="mt-0.5 text-xs text-sand-dark">Período: {fmtDate(`${from}T12:00:00Z`)} a {fmtDate(`${to}T12:00:00Z`)}</p>
              </header>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Recebido pelo Asaas" value={brl(report.gross)} hint={`${report.count} recebimento(s)`} />
                <Stat label="Tarifa paga ao Asaas" value={brl(report.fee)} tone="out" hint={`${report.feePercent.toString().replace('.', ',')}% do recebido · média ${brl(report.averageFee)}`} />
                <Stat label="Líquido (chegou à loja)" value={brl(report.net)} tone="in" />
                <Stat label="Absorvida pela loja" value={brl(report.absorbed)} tone="gold" hint={`Repassada aos irmãos: ${brl(report.passedOn)}`} />
              </section>

              {report.unknownFeeCount > 0 ? (
                <p className="text-xs text-amber-300">
                  {report.unknownFeeCount} recebimento(s) sem tarifa informada pelo Asaas (baixas antigas ou sem valor líquido) — não entram no total de tarifas.
                </p>
              ) : null}

              {report.outOfPolicy.length > 0 ? (
                <div className="card rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                  <p className="font-semibold">{report.outOfPolicy.length} recebimento(s) por método fora da política da loja (cartão)</p>
                  <p className="mt-1 text-xs">A loja emite só Pix ou boleto. Cobranças antigas emitidas com escolha livre do pagador ainda podem ser pagas no cartão — o dinheiro só cai depois de cerca de 32 dias.</p>
                </div>
              ) : null}

              <section className={CARD}>
                <h3 className="text-base font-semibold text-sand-light">Por método</h3>
                <table className="mt-3 w-full text-sm">
                  <thead><tr><th className={TH}>Método</th><th className={`${TH} num text-right`}>Recebimentos</th><th className={`${TH} num text-right`}>Recebido</th><th className={`${TH} num text-right`}>Tarifa</th></tr></thead>
                  <tbody>
                    {report.byMethod.map((b) => (
                      <tr key={b.key}>
                        <td className={`${TD} text-sand`}>{methodLabel(b.key === 'Não informado' ? null : b.key)}</td>
                        <td className={`${TD} num text-right tabular-nums text-sand-dark`}>{b.count}</td>
                        <td className={`${TD} num text-right tabular-nums text-sand-light`}>{brl(b.gross)}</td>
                        <td className={`${TD} num text-right tabular-nums text-rose-300`}>{brl(b.fee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className={CARD}>
                <h3 className="text-base font-semibold text-sand-light">Por mês</h3>
                <table className="mt-3 w-full text-sm">
                  <thead><tr><th className={TH}>Mês</th><th className={`${TH} num text-right`}>Recebimentos</th><th className={`${TH} num text-right`}>Recebido</th><th className={`${TH} num text-right`}>Tarifa</th></tr></thead>
                  <tbody>
                    {report.byMonth.map((b) => (
                      <tr key={b.key}>
                        <td className={`${TD} text-sand`}>{fmtMonth(b.key)}</td>
                        <td className={`${TD} num text-right tabular-nums text-sand-dark`}>{b.count}</td>
                        <td className={`${TD} num text-right tabular-nums text-sand-light`}>{brl(b.gross)}</td>
                        <td className={`${TD} num text-right tabular-nums text-rose-300`}>{brl(b.fee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className={CARD}>
                <h3 className="text-base font-semibold text-sand-light">Recebimentos do período</h3>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr><th className={TH}>Data</th><th className={TH}>Cobrança</th><th className={TH}>Irmão</th><th className={TH}>Método</th><th className={`${TH} num text-right`}>Recebido</th><th className={`${TH} num text-right`}>Tarifa</th><th className={`${TH} num text-right`}>Líquido</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className={`${TD} text-sand`}>{fmtDate(r.date)}</td>
                        <td className={`${TD} text-sand-dark`}>{r.invoiceNumber ?? '—'}</td>
                        <td className={`${TD} text-sand`}>{r.memberName ?? '—'}</td>
                        <td className={`${TD} text-sand-dark`}>{methodLabel(r.method)}</td>
                        <td className={`${TD} num text-right tabular-nums text-sand-light`}>{brl(r.gross)}</td>
                        <td className={`${TD} num text-right tabular-nums text-rose-300`}>{r.fee != null ? brl(r.fee) : '—'}</td>
                        <td className={`${TD} num text-right tabular-nums text-sand-light`}>{r.fee != null ? brl(r.gross - r.fee) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
