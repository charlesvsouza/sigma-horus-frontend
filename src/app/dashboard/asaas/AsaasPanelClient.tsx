"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState, inputClass } from '@/components/ui';
import { ReportActions } from '@/components/report/report-document';
import { brl } from '@/lib/currency';
import { csvNumber } from '@/lib/csv';
import { ASAAS_SITUATION_LABEL, type AsaasPanelSummary, type AsaasSituation } from '@/lib/asaas-panel';

interface Row {
  id: string; number: string | null; memberName: string | null; amount: number; dueDate: string; situation: AsaasSituation;
  method: string | null; fee: number | null; net: number | null; paidAt: string | null; url: string | null;
}

const BR = 'America/Sao_Paulo';
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const fmtPaid = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: BR });
const METHOD_LABEL: Record<string, string> = { PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de crédito', DEBIT_CARD: 'Cartão de débito', TRANSFER: 'Transferência', DEPOSIT: 'Depósito' };
const methodLabel = (m: string | null) => (m ? METHOD_LABEL[m] ?? m : '—');

const CARD = 'rounded-xl border border-white/6 bg-sigma-card p-5';
const TH = 'border-b border-white/10 px-2 py-2 text-left text-xs uppercase tracking-wide text-sand-dark/70';
const TD = 'border-b border-white/5 px-2 py-2';
const TONE: Record<AsaasSituation, string> = {
  waiting: 'bg-sky-500/15 text-sky-300',
  overdue: 'bg-rose-500/15 text-rose-300',
  settled: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-white/10 text-sand-dark',
};

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

export default function AsaasPanelClient({ asaasMode, env, connected, webhookOk, autoEmit, settlementName, balance, from, to, summary, rows }: {
  lodgeName: string; crestUrl: string | null; issuedBy?: string | null; asaasMode: boolean; env: string; connected: boolean; webhookOk: boolean;
  autoEmit: boolean; settlementName: string | null; balance: number | null; from: string; to: string; summary: AsaasPanelSummary; rows: Row[];
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const [filter, setFilter] = useState<AsaasSituation | 'all'>('all');
  const go = (f: string, t: string) => router.push(`/dashboard/asaas?from=${f}&to=${t}`);
  const shown = filter === 'all' ? rows : rows.filter((r) => r.situation === filter);

  function csvRows(): unknown[][] {
    return [
      ['Vencimento', 'Cobrança', 'Irmão', 'Situação', 'Forma', 'Valor', 'Tarifa', 'Líquido', 'Baixa'],
      ...shown.map((r) => [
        fmtDate(r.dueDate), r.number ?? '', r.memberName ?? '', ASAAS_SITUATION_LABEL[r.situation], methodLabel(r.method),
        csvNumber(r.amount), r.fee != null ? csvNumber(r.fee) : '', r.net != null ? csvNumber(r.net) : '', r.paidAt ? fmtPaid(r.paidAt) : '',
      ]),
    ];
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Painel do Asaas</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Acompanhe as cobranças emitidas no Asaas: quais estão aguardando, quais venceram e quais já foram pagas e baixadas, com a tarifa de cada uma e o saldo que está na conta do Asaas.
          </p>
        </div>

        {!asaasMode ? (
          <div className="rounded-xl border border-white/8 bg-sigma-card p-4 text-sm text-sand-dark">
            A loja está no <strong>Modo Loja</strong> (recebimento direto na conta da loja). Se já usou o Asaas antes, o histórico continua abaixo.
          </div>
        ) : null}
        {asaasMode && !connected ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            O Asaas não está conectado. Peça ao Administrador para configurar em <Link href="/dashboard/integracoes" className="underline">Integrações</Link>.
          </div>
        ) : null}
        {asaasMode && connected && !webhookOk ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            O webhook do Asaas não está configurado: sem ele, os pagamentos <strong>não são baixados automaticamente</strong>. O Administrador configura em <Link href="/dashboard/integracoes" className="underline">Integrações</Link>.
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Saldo na conta do Asaas"
            value={balance != null ? brl(balance) : '—'}
            tone="gold"
            hint={balance != null
              ? `Já pago e ainda não repassado${settlementName ? ` para ${settlementName}` : ''} · ${env === 'production' ? 'produção' : 'teste (sandbox)'}`
              : 'Não foi possível consultar o saldo agora.'}
          />
          <Stat label="Aguardando pagamento" value={brl(summary.waiting.total)} hint={`${summary.waiting.count} cobrança(s) no prazo`} />
          <Stat label="Vencidas" value={brl(summary.overdue.total)} tone="out" hint={`${summary.overdue.count} cobrança(s)`} />
          <Stat label="Pagas e baixadas" value={brl(summary.settled.total)} tone="in" hint={`${summary.settled.count} cobrança(s)`} />
          <Stat label="Tarifas do Asaas" value={brl(summary.settled.fees)} tone="out" hint={summary.unknownFee > 0 ? `${summary.unknownFee} baixa(s) sem tarifa informada` : 'Das cobranças baixadas'} />
          <Stat label="Líquido recebido" value={brl(summary.settled.net)} tone="in" hint="Valor pago − tarifas" />
          <Stat label="Emissão automática" value={autoEmit ? 'Ligada' : 'Desligada'} hint="Emite 5 dias antes do vencimento" />
          <Stat label="Canceladas" value={String(summary.cancelled.count)} />
        </section>

        <section className={CARD}>
          <h2 className="text-base font-semibold text-sand-light">Relatórios do Asaas</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {[
              { href: '/dashboard/relatorios/tarifas', label: 'Tarifas de cobrança (por método e por mês)' },
              { href: '/dashboard/relatorios/contas-recebidas', label: 'Contas recebidas' },
              { href: '/dashboard/cobrancas', label: 'Cobranças (emitir e reenviar)' },
              { href: '/dashboard/pagamentos', label: 'Baixa de pagamentos' },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand-dark transition-colors hover:border-white/20 hover:text-sand-light">{l.label}</Link>
            ))}
          </div>
        </section>

        <section className={CARD}>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs text-sand-dark">Vencimento de
              <input type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs text-sand-dark">até
              <input type="date" value={toVal} onChange={(e) => setToVal(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <div className="flex items-end">
              <button onClick={() => go(fromVal, toVal)} className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Aplicar</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {([['all', 'Todas'], ['waiting', 'Aguardando'], ['overdue', 'Vencidas'], ['settled', 'Pagas e baixadas'], ['cancelled', 'Canceladas']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                aria-pressed={filter === k}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${filter === k ? 'border-gold text-gold' : 'border-white/8 text-sand-dark hover:border-white/20 hover:text-sand-light'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {shown.length === 0 ? (
          <EmptyState title="Nenhuma cobrança do Asaas neste filtro." description="Cobranças emitidas no Asaas aparecem aqui, pelo vencimento. Ajuste o período ou o filtro." />
        ) : (
          <>
            <ReportActions csv={() => ({ filename: `asaas_${from}_${to}`, rows: csvRows() })} />
            <section className={CARD}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH}>Vencimento</th><th className={TH}>Cobrança</th><th className={TH}>Irmão</th><th className={TH}>Situação</th><th className={TH}>Forma</th>
                      <th className={`${TH} text-right`}>Valor</th><th className={`${TH} text-right`}>Tarifa</th><th className={`${TH} text-right`}>Líquido</th><th className={TH}>Baixa</th><th className={TH}><span className="sr-only">Link</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.id}>
                        <td className={`${TD} text-sand`}>{fmtDate(r.dueDate)}</td>
                        <td className={`${TD} text-sand-dark`}>{r.number ?? '—'}</td>
                        <td className={`${TD} text-sand`}>{r.memberName ?? '—'}</td>
                        <td className={TD}><span className={`rounded-full px-2.5 py-0.5 text-xs ${TONE[r.situation]}`}>{ASAAS_SITUATION_LABEL[r.situation]}</span></td>
                        <td className={`${TD} text-sand-dark`}>{methodLabel(r.method)}</td>
                        <td className={`${TD} text-right tabular-nums text-sand-light`}>{brl(r.amount)}</td>
                        <td className={`${TD} text-right tabular-nums text-rose-300`}>{r.fee != null ? brl(r.fee) : '—'}</td>
                        <td className={`${TD} text-right tabular-nums text-sand-light`}>{r.net != null ? brl(r.net) : '—'}</td>
                        <td className={`${TD} text-sand-dark`}>{r.paidAt ? fmtPaid(r.paidAt) : '—'}</td>
                        <td className={TD}>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-gold hover:text-gold-light">Abrir</a> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-sand-dark">{shown.length} cobrança(s). O saldo do Asaas é o que já foi pago e ainda não foi repassado à conta corrente da loja.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
