'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, inputClass, Alert, useConfirm } from '@/components/ui';

interface BalanceteItem {
  id: string;
  periodFrom: string;
  periodTo: string;
  totalReceivables: number;
  totalPayables: number;
  totalPayments: number;
  netBalance: number;
  presentedAt: string;
  approved: boolean;
  approvedAt?: string | null;
  notes?: string | null;
}

const brl = (n: number) => Number(n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR');

// Datas de veneralato/balancete só carregam dia/mês/ano (sem hora) — tudo em
// UTC-meia-noite pra bater com o que o input type="date" e o Prisma gravam.
function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addMonthsUtc(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}
function addDaysUtc(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}
function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}
// Formata direto dos componentes UTC — não usar toLocaleDateString aqui: o
// navegador converteria a meia-noite UTC pro fuso local (ex.: UTC-3) e
// mostraria o dia anterior.
function fmtUtc(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

interface QuickPeriod {
  label: string;
  months: number;
}

const QUICK_PERIODS: QuickPeriod[] = [
  { label: 'Bimestral', months: 2 },
  { label: 'Trimestral', months: 3 },
  { label: 'Semestral', months: 6 },
];

/**
 * Último período fechado (de N em N meses, a partir do início do veneralato
 * atual) cujo fim já passou — cobranças pontuais não contam, só o calendário.
 * Um período que termina hoje ainda não conta como fechado (só a partir de
 * amanhã), daí `nextUnlock` indicar quando o botão destrava.
 */
function lastCompleteQuickPeriod(termStart: Date, months: number, today: Date) {
  let from = termStart;
  let available: { from: Date; to: Date } | null = null;
  let nextUnlock = termStart;
  for (;;) {
    const nextFrom = addMonthsUtc(from, months);
    const to = addDaysUtc(nextFrom, -1);
    if (to.getTime() < today.getTime()) {
      available = { from, to };
      from = nextFrom;
      continue;
    }
    nextUnlock = nextFrom;
    break;
  }
  return { available, nextUnlock };
}

export default function BalancetesClient({
  items,
  canApprove,
  currentTermStart,
}: {
  items: BalanceteItem[];
  canApprove: boolean;
  currentTermStart: string | null;
}) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({ periodFrom: '', periodTo: '', notes: '' });
  const INPUT = inputClass;

  async function generatePeriod(periodFrom: string, periodTo: string, notes: string) {
    setGenerating(true);
    setMessage('');
    const res = await fetch('/api/balancetes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodFrom, periodTo, notes }),
    });
    const data = await res.json();
    setGenerating(false);
    if (res.ok) {
      setMessage('Balancete gerado.');
      setForm({ periodFrom: '', periodTo: '', notes: '' });
      router.refresh();
    } else {
      setMessage(data.error ?? 'Erro ao gerar balancete.');
    }
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    await generatePeriod(form.periodFrom, form.periodTo, form.notes);
  }

  const today = toUtcMidnight(new Date());
  const termStart = currentTermStart ? toUtcMidnight(new Date(currentTermStart)) : null;
  const quickPeriods = termStart
    ? QUICK_PERIODS.map((qp) => ({ ...qp, ...lastCompleteQuickPeriod(termStart, qp.months, today) }))
    : [];

  async function handleApprove(id: string) {
    const ok = await askConfirm({ title: 'Aprovar balancete', message: 'Registra que este balancete foi apresentado e aprovado em sessão.', confirmLabel: 'Aprovar' });
    if (!ok) return;
    const res = await fetch(`/api/balancetes/${id}/approve`, { method: 'POST' });
    const data = await res.json();
    setMessage(res.ok ? 'Balancete aprovado.' : data.error ?? 'Erro.');
    router.refresh();
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Balancetes periódicos</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Balancete trimestral/semestral apresentado em sessão, como exige o regulamento — independente do
            encerramento do veneralato (isso continua em Veneralato → Encerramento).
          </p>
        </div>

        {message ? <Alert intent="warn">{message}</Alert> : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Acesso rápido</h2>
          <p className="mt-1 text-xs text-sand-dark">
            Gera direto o balancete do último período fechado do veneralato atual. Um botão fica sem ação
            enquanto o veneralato ainda não tiver completado aquele período.
          </p>
          {!termStart ? (
            <p className="mt-4 text-sm text-sand-dark">Nenhum veneralato em exercício no momento.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-4">
              {quickPeriods.map((qp) => (
                <div key={qp.label} className="flex flex-col items-start gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={generating || !qp.available}
                    onClick={() => {
                      if (!qp.available) return;
                      void generatePeriod(toDateInputValue(qp.available.from), toDateInputValue(qp.available.to), '');
                    }}
                  >
                    {qp.label}
                  </Button>
                  <span className="text-xs text-sand-dark">
                    {qp.available
                      ? `${fmtUtc(qp.available.from)} — ${fmtUtc(qp.available.to)}`
                      : `Disponível a partir de ${fmtUtc(qp.nextUnlock)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Gerar balancete do período</h2>
          <form onSubmit={handleGenerate} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-sand-dark/70">De</span>
              <input type="date" value={form.periodFrom} onChange={(e) => setForm({ ...form, periodFrom: e.target.value })} className={`mt-1.5 ${INPUT}`} required />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-sand-dark/70">Até</span>
              <input type="date" value={form.periodTo} onChange={(e) => setForm({ ...form, periodTo: e.target.value })} className={`mt-1.5 ${INPUT}`} required />
            </label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${INPUT} md:col-span-2`} placeholder="Observações (opcional)" rows={2} />
            <Button type="submit" disabled={generating} className="md:col-span-2">{generating ? 'Gerando…' : 'Gerar balancete'}</Button>
          </form>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Histórico</h2>
          <div className="mt-5 space-y-3">
            {items.length === 0 ? (
              <EmptyState title="Nenhum balancete gerado" description="Gere o balancete do trimestre/semestre para apresentar em sessão." />
            ) : items.map((b) => (
              <div key={b.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-sand-light">{fmt(b.periodFrom)} — {fmt(b.periodTo)}</p>
                    <p className="mt-1 text-xs text-sand-dark">Apresentado em {fmt(b.presentedAt)}{b.notes ? ` • ${b.notes}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.approved ? (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300">Aprovado {b.approvedAt ? `em ${fmt(b.approvedAt)}` : ''}</span>
                    ) : (
                      <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-0.5 text-xs text-gold">Aguardando aprovação</span>
                    )}
                    {!b.approved && canApprove ? (
                      <button onClick={() => void handleApprove(b.id)} className="text-xs text-emerald-300/80 transition hover:text-emerald-300">Aprovar</button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-sand-dark md:grid-cols-4">
                  <span>A receber: <span className="text-sand-light">{brl(b.totalReceivables)}</span></span>
                  <span>A pagar: <span className="text-sand-light">{brl(b.totalPayables)}</span></span>
                  <span>Pagamentos: <span className="text-sand-light">{brl(b.totalPayments)}</span></span>
                  <span>Saldo líquido: <span className={b.netBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{brl(b.netBalance)}</span></span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
