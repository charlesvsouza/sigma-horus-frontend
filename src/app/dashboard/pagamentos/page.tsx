"use client";

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Button, EmptyState, Skeleton, inputClass } from '@/components/ui';

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

export default function PagamentosPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ accountId: '', memberId: '', amount: '', paidAt: '', method: 'manual', note: '' });
  const [consent, setConsent] = useState(false);

  async function loadData() {
    setLoading(true);
    const [accountsResponse, membersResponse, paymentsResponse] = await Promise.all([
      fetch('/api/accounts'),
      fetch('/api/members'),
      fetch('/api/payments'),
    ]);

    const accountsData = await accountsResponse.json();
    const membersData = await membersResponse.json();
    const paymentsData = await paymentsResponse.json();

    setAccounts(accountsData.items ?? []);
    setMembers(membersData.items ?? []);
    setPayments(paymentsData.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

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
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao registrar pagamento.');
    }
  }

  const INPUT = inputClass; // fonte única do design system

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-sand-light">Pagamentos</h1>
          <p className="mt-1 text-sm text-sand-dark">Registre entradas e saídas de caixa vinculadas às contas do MVP.</p>
        </div>

        {message ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

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
          <h2 className="text-base font-semibold text-sand-light">Pagamentos recentes</h2>
          <div className="mt-5 space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4">
                  <Skeleton variant="text" className="w-1/3" />
                  <Skeleton variant="text" className="w-20" />
                </div>
              ))
            ) : payments.length === 0 ? (
              <EmptyState title="Nenhum pagamento registrado" description="Registre baixas manuais aqui; as baixas automáticas do Asaas aparecem assim que o webhook confirma o pagamento." />
            ) : payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/[8%]">
                <div>
                  <p className="text-sm font-medium text-sand-light">{payment.account?.title ?? 'Conta removida'}</p>
                  <p className="mt-1 text-xs text-sand-dark">{payment.member?.name ?? 'Sem vínculo'} • {payment.method}</p>
                </div>
                <div className="text-right text-xs text-sand-dark">
                  <p className="tabular-nums">Valor: R$ {payment.amount.toFixed(2)}</p>
                  <p className="mt-0.5">Data: {new Date(payment.paidAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
