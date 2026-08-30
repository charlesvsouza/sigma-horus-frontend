"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, inputClass, Alert } from '@/components/ui';

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
  isDues: boolean;
  approvalStatus: string;
  member?: MemberOption | null;
}

const INPUT_CLASS = inputClass; // fonte única do design system

export default function ContasClient({ accounts, members, chartAccounts, role }: { accounts: AccountItem[]; members: MemberOption[]; chartAccounts: ChartAccountOption[]; role: string }) {
  const canApprove = role === 'venerable' || role === 'admin';
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
    isDues: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  function startEdit(account: AccountItem) {
    setEditingId(account.id);
    setForm({
      title: account.title,
      type: account.type,
      chartAccountId: '',
      amount: String(account.amount),
      dueDate: account.dueDate.slice(0, 10),
      status: account.status,
      description: account.description ?? '',
      memberId: account.member?.id ?? '',
      isDues: account.isDues,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ title: '', type: 'RECEIVABLE', chartAccountId: '', amount: '', dueDate: '', status: 'pending', description: '', memberId: '', isDues: false });
  }

  function selectChart(id: string) {
    const chart = chartAccounts.find((c) => c.id === id);
    if (chart) {
      setForm((prev) => ({ ...prev, chartAccountId: id, title: chart.name, type: chart.type === 'REVENUE' ? 'RECEIVABLE' : 'PAYABLE' }));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // No modo edição, a categoria (chartAccountId) não vem pré-carregada no
    // form — omitir do payload evita apagar por engano o vínculo já existente.
    const { chartAccountId, ...rest } = form;
    const payload = {
      ...rest,
      ...(editingId ? {} : { chartAccountId }),
      amount: Number(form.amount),
      memberId: form.memberId || undefined,
    };
    const response = await fetch(editingId ? `/api/accounts/${editingId}` : '/api/accounts', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (response.ok) {
      setMessage(editingId ? 'Conta atualizada com sucesso.' : 'Conta cadastrada com sucesso.');
      cancelEdit();
      router.refresh();
    } else {
      setMessage(data.error ?? (editingId ? 'Erro ao atualizar conta.' : 'Erro ao cadastrar conta.'));
    }
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (response.ok) router.refresh();
  }

  async function handleApprove(id: string) {
    const response = await fetch(`/api/accounts/${id}/approve`, { method: 'POST' });
    const data = await response.json();
    if (response.ok) {
      setMessage('Despesa aprovada.');
      router.refresh();
    } else {
      setMessage(data.error ?? 'Erro ao aprovar despesa.');
    }
  }

  const filteredCharts = chartAccounts.filter((c) =>
    form.type === 'RECEIVABLE' ? c.type === 'REVENUE' : c.type === 'EXPENSE'
  );

  const q = search.trim().toLowerCase();
  const filteredAccounts = q
    ? accounts.filter((a) => a.title.toLowerCase().includes(q) || a.member?.name.toLowerCase().includes(q) || a.status.toLowerCase().includes(q))
    : accounts;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Contas a receber e pagar</h1>
          <p className="mt-1 text-sm text-sand-dark">Registre contas financeiras e acompanhe vencimentos com base no fluxo do MVP.</p>
        </div>

        {message ? <Alert intent="warn">{message}</Alert> : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-sand-light">{editingId ? 'Editar conta' : 'Nova conta'}</h2>
            {editingId ? <button type="button" onClick={cancelEdit} className="text-xs text-sand-dark hover:text-sand">Cancelar edição</button> : null}
          </div>
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
            {form.type === 'RECEIVABLE' && form.memberId ? (
              <label className="flex items-center gap-2 text-sm text-sand-dark md:col-span-2">
                <input type="checkbox" checked={form.isDues} onChange={(event) => setForm({ ...form, isDues: event.target.checked })} />
                É mensalidade do membro (conta para a regra do Art. 002 — 60 dias de inadimplência)
              </label>
            ) : null}
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${INPUT_CLASS} md:col-span-2`} placeholder="Descrição" rows={3} />
            <Button type="submit" className="md:col-span-2">{editingId ? 'Salvar alterações' : 'Salvar conta'}</Button>
          </form>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-sand-light">Contas cadastradas</h2>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, membro ou status…" className={`${INPUT_CLASS} max-w-xs`} />
          </div>
          <div className="mt-5 space-y-3">
            {accounts.length === 0 ? (
              <EmptyState title="Nenhuma conta cadastrada" description="Lance a primeira conta a receber ou a pagar para acompanhar vencimentos e o fluxo de caixa." />
            ) : filteredAccounts.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhuma conta encontrada para &quot;{search}&quot;.</p>
            ) : filteredAccounts.map((account) => (
              <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/[8%]">
                <div>
                  <p className="text-sm font-medium text-sand-light">
                    {account.title}
                    {account.isDues ? <span className="ml-2 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">Mensalidade</span> : null}
                    {account.approvalStatus === 'pending' ? <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">Aguardando aprovação</span> : null}
                  </p>
                  <p className="mt-1 text-xs text-sand-dark">{account.type === 'RECEIVABLE' ? 'Conta a receber' : 'Conta a pagar'} • {account.member?.name ?? 'Sem vínculo'}</p>
                </div>
                <div className="text-right text-xs text-sand-dark">
                  <p className="tabular-nums">R$ {account.amount.toFixed(2)}</p>
                  <p className="mt-0.5">{new Date(account.dueDate).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex items-center gap-3">
                  {account.approvalStatus === 'pending' && canApprove ? (
                    <button onClick={() => void handleApprove(account.id)} className="text-xs text-emerald-300/80 transition hover:text-emerald-300">Aprovar</button>
                  ) : null}
                  <button onClick={() => startEdit(account)} className="text-xs text-gold/70 transition hover:text-gold">Editar</button>
                  <button onClick={() => void handleDelete(account.id)} className="text-xs text-rose-300/60 transition hover:text-rose-300">Remover</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
