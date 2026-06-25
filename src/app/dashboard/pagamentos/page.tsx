"use client";

import { FormEvent, useEffect, useState } from 'react';

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
  const [form, setForm] = useState({ accountId: '', memberId: '', amount: '', paidAt: '', method: 'manual', note: '' });

  async function loadData() {
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
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao registrar pagamento.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Pagamentos</h1>
          <p className="mt-3 text-slate-400">Registre entradas e saídas de caixa vinculadas às contas do MVP.</p>
        </div>

        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Novo pagamento</h2>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" required>
              <option value="">Selecione uma conta</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.title}</option>)}
            </select>
            <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
              <option value="">Vincular a um membro</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Valor" required />
            <input type="date" value={form.paidAt} onChange={(event) => setForm({ ...form, paidAt: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" required />
            <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2">
              <option value="manual">Manual</option>
              <option value="pix">PIX</option>
              <option value="cash">Dinheiro</option>
              <option value="card">Cartão</option>
            </select>
            <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2" placeholder="Observação" rows={3} />
            <button type="submit" className="rounded-full bg-amber-400 px-4 py-3 font-medium text-slate-950 md:col-span-2">Registrar pagamento</button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Pagamentos recentes</h2>
          <div className="mt-6 space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <div>
                  <p className="font-medium">{payment.account?.title ?? 'Conta removida'}</p>
                  <p className="text-sm text-slate-400">{payment.member?.name ?? 'Sem vínculo'} • {payment.method}</p>
                </div>
                <div className="text-sm text-slate-400">
                  <p>Valor: R$ {payment.amount.toFixed(2)}</p>
                  <p>Data: {new Date(payment.paidAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
