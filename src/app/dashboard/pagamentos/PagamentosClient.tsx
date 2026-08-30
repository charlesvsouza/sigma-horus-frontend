"use client";

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, inputClass, Alert, useConfirm } from '@/components/ui';

interface MemberOption { id: string; name: string; }
interface AccountOption { id: string; title: string; type: string; amount: number; }
interface PaymentItem {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  note?: string | null;
  account?: { id: string; title: string; type: string } | null;
  member?: { id: string; name: string } | null;
}

export default function PagamentosClient({ accounts, members, payments }: { accounts: AccountOption[]; members: MemberOption[]; payments: PaymentItem[] }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ accountId: '', memberId: '', amount: '', paidAt: '', method: 'manual', note: '' });
  const [consent, setConsent] = useState(false);
  const [search, setSearch] = useState('');

  async function handleEstorno(id: string) {
    const ok = await askConfirm({
      title: 'Estornar pagamento',
      message: 'Remove este pagamento e recalcula o status da conta (volta a ficar pendente, se for o caso). Não pode ser desfeito.',
      confirmLabel: 'Estornar',
      intent: 'danger',
    });
    if (!ok) return;
    const response = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage('Pagamento estornado.');
      router.refresh();
    } else {
      setMessage(data.error ?? 'Erro ao estornar pagamento.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!consent) {
      setMessage('Confirme a ciência sobre os lançamentos antes de registrar.');
      return;
    }
    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        memberId: form.memberId || undefined,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      setMessage('Pagamento registrado com sucesso.');
      setForm({ accountId: '', memberId: '', amount: '', paidAt: '', method: 'manual', note: '' });
      setConsent(false);
      router.refresh();
    } else {
      setMessage(data.error ?? 'Erro ao registrar pagamento.');
    }
  }

  const INPUT = inputClass; // fonte única do design system

  const q = search.trim().toLowerCase();
  const filteredPayments = q
    ? payments.filter((p) => p.account?.title.toLowerCase().includes(q) || p.member?.name.toLowerCase().includes(q) || p.method.toLowerCase().includes(q))
    : payments;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Pagamentos</h1>
          <p className="mt-1 text-sm text-sand-dark">Registre entradas e saídas de caixa vinculadas às contas do MVP.</p>
        </div>

        {message ? <Alert intent="warn">{message}</Alert> : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Novo pagamento</h2>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
            <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} className={INPUT} required>
              <option value="">Selecione uma conta</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.title}</option>)}
            </select>
            <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} className={INPUT}>
              <option value="">Vincular a um membro</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={INPUT} placeholder="Valor" required />
            <input type="date" value={form.paidAt} onChange={(event) => setForm({ ...form, paidAt: event.target.value })} className={INPUT} required />
            <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} className={`${INPUT} md:col-span-2`}>
              <option value="manual">Manual</option>
              <option value="pix">PIX</option>
              <option value="cash">Dinheiro</option>
              <option value="card">Cartão</option>
            </select>
            <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className={`${INPUT} md:col-span-2`} placeholder="Observação" rows={3} />
            <label className="flex items-start gap-3 rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-3 md:col-span-2">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-gold" />
              <span className="text-sm text-sand">
                Declaro estar ciente e de acordo com o registro deste e de eventuais lançamentos recorrentes,
                confirmo a veracidade dos dados informados e li os{' '}
                <Link href="/termos" target="_blank" className="text-gold hover:text-gold-light">Termos de Uso</Link>.
              </span>
            </label>
            <Button type="submit" disabled={!consent} className="md:col-span-2">Registrar pagamento</Button>
          </form>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-sand-light">Pagamentos recentes</h2>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por conta, membro ou forma…" className={`${INPUT} max-w-xs`} />
          </div>
          <div className="mt-5 space-y-3">
            {payments.length === 0 ? (
              <EmptyState title="Nenhum pagamento registrado" description="Registre baixas manuais aqui; as baixas automáticas do Asaas aparecem assim que o webhook confirma o pagamento." />
            ) : filteredPayments.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhum pagamento encontrado para &quot;{search}&quot;.</p>
            ) : filteredPayments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/[8%]">
                <div>
                  <p className="text-sm font-medium text-sand-light">{payment.account?.title ?? 'Conta removida'}</p>
                  <p className="mt-1 text-xs text-sand-dark">{payment.member?.name ?? 'Sem vínculo'} • {payment.method}</p>
                </div>
                <div className="text-right text-xs text-sand-dark">
                  <p className="tabular-nums">Valor: R$ {payment.amount.toFixed(2)}</p>
                  <p className="mt-0.5">Data: {new Date(payment.paidAt).toLocaleDateString('pt-BR')}</p>
                  <div className="mt-1 flex items-center justify-end gap-3">
                    <Link href={`/dashboard/pagamentos/${payment.id}/recibo`} target="_blank" className="text-xs text-gold/70 transition hover:text-gold">Recibo</Link>
                    <button onClick={() => void handleEstorno(payment.id)} className="text-xs text-rose-300/60 transition hover:text-rose-300">Estornar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
