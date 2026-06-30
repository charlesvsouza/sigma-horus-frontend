"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, inputClass } from '@/components/ui';

interface ChartAccountOption { id: string; code: string; name: string; type: string; }
interface MemberOption { id: string; name: string; }
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

const INPUT_CLASS = inputClass; // fonte única do design system

export default function ContasClient({ accounts, members, chartAccounts }: { accounts: AccountItem[]; members: MemberOption[]; chartAccounts: ChartAccountOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    title: '',
    type: 'RECEIVABLE',
    chartAccountId: '',
    amount: '',
    dueDate: '',
    status: 'pending',
    description: '',
    memberId: '',
  });

  function selectChart(id: string) {
    const chart = chartAccounts.find((c) => c.id === id);
    if (chart) {
      setForm((prev) => ({ ...prev, chartAccountId: id, title: chart.name, type: chart.type === 'REVENUE' ? 'RECEIVABLE' : 'PAYABLE' }));
    }
  }

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
      setForm({ title: '', type: 'RECEIVABLE', chartAccountId: '', amount: '', dueDate: '', status: 'pending', description: '', memberId: '' });
      router.refresh();
    } else {
      setMessage(data.error ?? 'Erro ao cadastrar conta.');
    }
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (response.ok) router.refresh();
  }

  const filteredCharts = chartAccounts.filter((c) =>
    form.type === 'RECEIVABLE' ? c.type === 'REVENUE' : c.type === 'EXPENSE'
  );

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-sand-light">Contas a receber e pagar</h1>
          <p className="mt-1 text-sm text-sand-dark">Registre contas financeiras e acompanhe vencimentos com base no fluxo do MVP.</p>
        </div>

        {message ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Nova conta</h2>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
            <select value={form.chartAccountId} onChange={(e) => selectChart(e.target.value)} className={INPUT_CLASS}>
              <option value="">Categoria (plano de contas)</option>
              {filteredCharts.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={INPUT_CLASS} placeholder="Título da conta" required />
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className={INPUT_CLASS}>
              <option value="RECEIVABLE">Conta a receber</option>
              <option value="PAYABLE">Conta a pagar</option>
            </select>
            <input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={INPUT_CLASS} placeholder="Valor" required />
            <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className={INPUT_CLASS} required />
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className={`${INPUT_CLASS} md:col-span-2`}>
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="overdue">Vencido</option>
            </select>
            <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} className={`${INPUT_CLASS} md:col-span-2`}>
              <option value="">Vincular a um membro (opcional)</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${INPUT_CLASS} md:col-span-2`} placeholder="Descrição" rows={3} />
            <Button type="submit" className="md:col-span-2">Salvar conta</Button>
          </form>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Contas cadastradas</h2>
          <div className="mt-5 space-y-3">
            {accounts.length === 0 ? (
              <EmptyState title="Nenhuma conta cadastrada" description="Lance a primeira conta a receber ou a pagar para acompanhar vencimentos e o fluxo de caixa." />
            ) : accounts.map((account) => (
              <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/[8%]">
                <div>
                  <p className="text-sm font-medium text-sand-light">{account.title}</p>
                  <p className="mt-1 text-xs text-sand-dark">{account.type === 'RECEIVABLE' ? 'Conta a receber' : 'Conta a pagar'} • {account.member?.name ?? 'Sem vínculo'}</p>
                </div>
                <div className="text-right text-xs text-sand-dark">
                  <p className="tabular-nums">R$ {account.amount.toFixed(2)}</p>
                  <p className="mt-0.5">{new Date(account.dueDate).toLocaleDateString('pt-BR')}</p>
                </div>
                <button onClick={() => void handleDelete(account.id)} className="text-xs text-rose-300/60 transition hover:text-rose-300">Remover</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
