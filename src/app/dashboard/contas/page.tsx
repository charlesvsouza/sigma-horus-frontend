"use client";

import { FormEvent, useEffect, useState } from 'react';

interface MemberOption {
  id: string;
  name: string;
}

interface AccountItem {
  id: string;
  title: string;
  type: string;
  amount: number;
  dueDate: string;
  status: string;
  description?: string | null;
  member?: MemberOption | null;
}

export default function ContasPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: '',
    type: 'RECEIVABLE',
    amount: '',
    dueDate: '',
    status: 'pending',
    description: '',
    memberId: '',
  });

  async function loadData() {
    setLoading(true);
    const [accountsResponse, membersResponse] = await Promise.all([
      fetch('/api/accounts'),
      fetch('/api/members'),
    ]);

    const accountsData = await accountsResponse.json();
    const membersData = await membersResponse.json();
    setAccounts(accountsData.items ?? []);
    setMembers(membersData.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/accounts', {
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
      setMessage('Conta cadastrada com sucesso.');
      setForm({ title: '', type: 'RECEIVABLE', amount: '', dueDate: '', status: 'pending', description: '', memberId: '' });
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao cadastrar conta.');
    }
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (response.ok) {
      await loadData();
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Contas a receber e pagar</h1>
          <p className="mt-3 text-slate-400">Registre contas financeiras e acompanhe vencimentos com base no fluxo do MVP.</p>
        </div>

        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Nova conta</h2>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Título da conta" required />
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
              <option value="RECEIVABLE">Conta a receber</option>
              <option value="PAYABLE">Conta a pagar</option>
            </select>
            <input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Valor" required />
            <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" required />
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2">
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="overdue">Vencido</option>
            </select>
            <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2">
              <option value="">Vincular a um membro (opcional)</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2" placeholder="Descrição" rows={3} />
            <button type="submit" className="rounded-full bg-amber-400 px-4 py-3 font-medium text-slate-950 md:col-span-2">Salvar conta</button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Contas cadastradas</h2>
          <div className="mt-6 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma conta cadastrada.</p>
            ) : accounts.map((account) => (
              <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <div>
                  <p className="font-medium">{account.title}</p>
                  <p className="text-sm text-slate-400">{account.type === 'RECEIVABLE' ? 'Conta a receber' : 'Conta a pagar'} • {account.member?.name ?? 'Sem vínculo'}</p>
                </div>
                <div className="text-sm text-slate-400">
                  <p>Valor: R$ {account.amount.toFixed(2)}</p>
                  <p>Vencimento: {new Date(account.dueDate).toLocaleDateString('pt-BR')}</p>
                </div>
                <button onClick={() => void handleDelete(account.id)} className="text-sm text-rose-400">Remover</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
