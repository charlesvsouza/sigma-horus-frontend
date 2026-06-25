"use client";

import { FormEvent, useEffect, useState } from 'react';

interface MemberOption { id: string; name: string; }
interface AccountOption { id: string; title: string; }
interface InvoiceItem {
  id: string;
  number: string;
  amount: number;
  dueDate: string;
  status: string;
  description?: string | null;
  isRecurring?: boolean;
  recurringInterval?: string | null;
  recurringCount?: number | null;
  nextDueDate?: string | null;
  account?: AccountOption | null;
  member?: MemberOption | null;
}

export default function CobrancasPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState({ accountId: '', memberId: '', number: '', amount: '', dueDate: '', description: '', isRecurring: false, recurringInterval: 'monthly', recurringCount: '' });

  async function loadData() {
    setLoading(true);
    const [invoicesResponse, accountsResponse, membersResponse] = await Promise.all([
      fetch('/api/invoices'),
      fetch('/api/accounts'),
      fetch('/api/members'),
    ]);

    const invoicesData = await invoicesResponse.json();
    const accountsData = await accountsResponse.json();
    const membersData = await membersResponse.json();
    setInvoices(invoicesData.items ?? []);
    setAccounts(accountsData.items ?? []);
    setMembers(membersData.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/invoices', {
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
      setMessage('Cobrança criada com sucesso.');
      setForm({ accountId: '', memberId: '', number: '', amount: '', dueDate: '', description: '', isRecurring: false, recurringInterval: 'monthly', recurringCount: '' });
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao criar cobrança.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Cobranças</h1>
          <p className="mt-3 text-slate-400">Gere cobranças simples e acompanhe o status das contas a receber.</p>
        </div>

        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recorrência</h2>
            <button
              onClick={async () => {
                setProcessing(true);
                setMessage('');
                const res = await fetch('/api/cron/recurring-invoices', { method: 'POST' });
                const data = await res.json();
                setMessage(`Processadas: ${data.processed} cobranças recorrentes.`);
                setProcessing(false);
                await loadData();
              }}
              disabled={processing}
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
            >
              {processing ? 'Processando...' : 'Processar recorrentes'}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Nova cobrança</h2>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" required>
              <option value="">Selecione uma conta</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.title}</option>)}
            </select>
            <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
              <option value="">Vincular a um membro</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Número / referência" required />
            <input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Valor" required />
            <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" required />
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Descrição" rows={3} />
            <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2">
              <input type="checkbox" checked={form.isRecurring} onChange={(event) => setForm({ ...form, isRecurring: event.target.checked })} />
              <span className="text-sm text-slate-300">Criar como cobrança recorrente</span>
            </label>
            <select value={form.recurringInterval} onChange={(event) => setForm({ ...form, recurringInterval: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" disabled={!form.isRecurring}>
              <option value="monthly">Mensal</option>
              <option value="quarterly">Trimestral</option>
              <option value="yearly">Anual</option>
            </select>
            <input type="number" min="1" value={form.recurringCount} onChange={(event) => setForm({ ...form, recurringCount: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Qtde. de ocorrências" disabled={!form.isRecurring} />
            <button type="submit" className="rounded-full bg-amber-400 px-4 py-3 font-medium text-slate-950 md:col-span-2">Criar cobrança</button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Cobranças cadastradas</h2>
          <div className="mt-6 space-y-3">
            {loading ? <p className="text-sm text-slate-500">Carregando...</p> : invoices.length === 0 ? <p className="text-sm text-slate-500">Nenhuma cobrança cadastrada.</p> : invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <div>
                  <p className="font-medium">{invoice.number}</p>
                  <p className="text-sm text-slate-400">{invoice.account?.title ?? 'Conta sem título'} • {invoice.member?.name ?? 'Sem membro'}</p>
                </div>
                <div className="text-sm text-slate-400">
                  <p>Valor: R$ {invoice.amount.toFixed(2)}</p>
                  <p>Vencimento: {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}</p>
                  {invoice.isRecurring ? (
                    <p className="mt-1 text-amber-300">Recorrente • {invoice.recurringInterval === 'quarterly' ? 'trimestral' : invoice.recurringInterval === 'yearly' ? 'anual' : 'mensal'}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

