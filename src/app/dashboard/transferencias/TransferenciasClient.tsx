"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormCard, EmptyState, inputClass, Alert, useConfirm } from '@/components/ui';
import { brl as money } from '@/lib/currency';

interface FinancialAccountOption { id: string; name: string; kind: string; isInvestment: boolean; active: boolean; saldo: number; }
interface TransferItem {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  status: string; // pending | approved | rejected
  from: { id: string; name: string; kind: string };
  to: { id: string; name: string; kind: string };
}

const STATUS_LABEL: Record<string, string> = { pending: 'Pendente', approved: 'Aprovada', rejected: 'Rejeitada' };
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-300',
  approved: 'bg-emerald-500/10 text-emerald-300',
  rejected: 'bg-rose-500/10 text-rose-300',
};

export default function TransferenciasClient({ financialAccounts, transfers, role }: { financialAccounts: FinancialAccountOption[]; transfers: TransferItem[]; role: string }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const canApprove = role === 'venerable' || role === 'admin';
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ fromId: '', toId: '', amount: '', date: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const activeAccounts = financialAccounts.filter((f) => f.active);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/financial-accounts/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ kind: 'ok', text: 'Transferência criada — aguardando aprovação do Venerável Mestre.' });
        setForm({ fromId: '', toId: '', amount: '', date: '', note: '' });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao criar transferência.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(id: string, action: 'approve' | 'reject') {
    const t = transfers.find((item) => item.id === id);
    const valueLine = t ? `${money(t.amount)} de ${t.from.name} para ${t.to.name}` : 'esta transferência';
    const ok = await askConfirm({
      title: action === 'approve' ? 'Aprovar transferência' : 'Rejeitar transferência',
      message:
        action === 'approve'
          ? `Aprovar ${valueLine}? O saldo das duas contas muda imediatamente.`
          : `Rejeitar ${valueLine}? Ela não afetará o saldo de nenhuma conta.`,
      confirmLabel: action === 'approve' ? 'Aprovar' : 'Rejeitar',
      intent: action === 'approve' ? 'default' : 'danger',
    });
    if (!ok) return;

    setDecidingId(id);
    try {
      const response = await fetch(`/api/financial-accounts/transfer/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ kind: 'ok', text: action === 'approve' ? 'Transferência aprovada e efetivada.' : 'Transferência rejeitada.' });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao decidir transferência.' });
      }
    } finally {
      setDecidingId(null);
    }
  }

  const INPUT = inputClass;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Transferências entre contas</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Mova saldo entre bancos, contas de investimento e o Caixa da loja. O Tesoureiro inicia; o Venerável Mestre (ou Administrador) aprova antes de o saldo mudar.
          </p>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Saldo atual por conta</h2>
          {financialAccounts.length === 0 ? (
            <p className="mt-3 text-sm text-sand-dark">Nenhuma conta bancária/caixa cadastrada ainda — cadastre em Cadastros mestre.</p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {financialAccounts.map((f) => (
                <li key={f.id} className={`rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-3 ${!f.active ? 'opacity-50' : ''}`}>
                  <p className="text-sm font-medium text-sand-light">{f.name}{f.isInvestment ? ' (Investimento)' : ''}</p>
                  <p className="mt-1 text-lg tabular-nums text-gold">{money(f.saldo)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <FormCard title="Nova transferência">
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <select aria-label="De (origem)" value={form.fromId} onChange={(e) => setForm({ ...form, fromId: e.target.value })} className={INPUT} required>
                  <option value="">De (origem)</option>
                  {activeAccounts.map((f) => <option key={f.id} value={f.id} disabled={f.id === form.toId}>{f.name}</option>)}
                </select>
                <select aria-label="Para (destino)" value={form.toId} onChange={(e) => setForm({ ...form, toId: e.target.value })} className={INPUT} required>
                  <option value="">Para (destino)</option>
                  {activeAccounts.map((f) => <option key={f.id} value={f.id} disabled={f.id === form.fromId}>{f.name}</option>)}
                </select>
                <input aria-label="Valor" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={INPUT} placeholder="Valor" required />
                <input aria-label="Data" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={INPUT} required />
                <textarea aria-label="Observação" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={`${INPUT} md:col-span-2`} placeholder="Observação (opcional)" rows={2} />
              </div>
              <Button type="submit" disabled={submitting || activeAccounts.length < 2}>{submitting ? 'Enviando…' : 'Solicitar transferência'}</Button>
              {activeAccounts.length < 2 ? <p className="text-xs text-sand-dark">Cadastre pelo menos duas contas ativas em Cadastros mestre para transferir entre elas.</p> : null}
            </form>
          </FormCard>

          <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Histórico</h2>
            <div className="mt-4 space-y-3">
              {transfers.length === 0 ? (
                <EmptyState title="O saldo repousa onde está." description="As transferências solicitadas pelo Tesoureiro aparecem aqui, aguardando aprovação do Venerável Mestre." />
              ) : transfers.map((t) => (
                <div key={t.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-sand-light">{t.from.name} → {t.to.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${STATUS_CLASS[t.status] ?? ''}`}>{STATUS_LABEL[t.status] ?? t.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-sand-dark">{new Date(t.date).toLocaleDateString('pt-BR')} • {money(t.amount)}{t.note ? ` • ${t.note}` : ''}</p>
                  {t.status === 'pending' && canApprove ? (
                    <div className="mt-2 flex items-center gap-3">
                      <button disabled={decidingId === t.id} onClick={() => void decide(t.id, 'approve')} className="text-xs text-emerald-300/80 transition hover:text-emerald-300 disabled:opacity-40">Aprovar</button>
                      <button disabled={decidingId === t.id} onClick={() => void decide(t.id, 'reject')} className="text-xs text-rose-300/60 transition hover:text-rose-300 disabled:opacity-40">Rejeitar</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
