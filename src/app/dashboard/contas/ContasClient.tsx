"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, CollapsibleCard, EmptyState, Field, FormCard, inputClass, useConfirm } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';

interface ChartAccountOption { id: string; code: string; name: string; type: string; defaultBankAccountId?: string | null; }
interface MemberOption { id: string; name: string; }
interface CounterpartyOption { id: string; name: string; kind: string; }
interface FinancialAccountOption { id: string; name: string; kind: string; }
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
  awaitingAsaas?: boolean;
  member?: MemberOption | null;
  counterparty?: CounterpartyOption | null;
  bankAccount?: FinancialAccountOption | null;
}

const INPUT_CLASS = inputClass; // fonte única do design system

export default function ContasClient({ accounts, members, chartAccounts, counterparties, financialAccounts, role, startWithForm = false }: { accounts: AccountItem[]; members: MemberOption[]; chartAccounts: ChartAccountOption[]; counterparties: CounterpartyOption[]; financialAccounts: FinancialAccountOption[]; role: string; startWithForm?: boolean }) {
  const canApprove = role === 'venerable' || role === 'admin';
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    type: 'RECEIVABLE',
    chartAccountId: '',
    amount: '',
    dueDate: '',
    status: 'pending',
    description: '',
    memberId: '',
    counterpartyId: '',
    bankAccountId: '',
    isDues: false,
    paidAt: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  // O formulário de lançamento abre pelo item "Lançamento" do menu (startWithForm) — e fica aberto
  // entre um lançamento e outro. Em /contas (só a lista) abre ao editar uma conta; sem contas ainda, já vem aberto.
  const [formOpen, setFormOpen] = useState(startWithForm || accounts.length === 0);
  const [search, setSearch] = useState('');

  function startEdit(account: AccountItem) {
    setEditingId(account.id);
    setFormOpen(true);
    setForm({
      title: account.title,
      type: account.type,
      chartAccountId: '',
      amount: String(account.amount),
      dueDate: account.dueDate.slice(0, 10),
      status: account.status,
      description: account.description ?? '',
      memberId: account.member?.id ?? '',
      counterpartyId: account.counterparty?.id ?? '',
      bankAccountId: account.bankAccount?.id ?? '',
      isDues: account.isDues,
      paidAt: '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setFormOpen(startWithForm);
    setForm({ title: '', type: 'RECEIVABLE', chartAccountId: '', amount: '', dueDate: '', status: 'pending', description: '', memberId: '', counterpartyId: '', bankAccountId: '', isDues: false, paidAt: '' });
  }

  function selectChart(id: string) {
    const chart = chartAccounts.find((c) => c.id === id);
    if (chart) {
      setForm((prev) => ({ ...prev, chartAccountId: id, title: chart.name, type: chart.type === 'REVENUE' ? 'RECEIVABLE' : 'PAYABLE', bankAccountId: prev.bankAccountId || chart.defaultBankAccountId || '' }));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      // No modo edição, a categoria (chartAccountId) não vem pré-carregada no
      // form — omitir do payload evita apagar por engano o vínculo já existente.
      const { chartAccountId, ...rest } = form;
      const payload = {
        ...rest,
        ...(editingId ? {} : { chartAccountId }),
        amount: Number(form.amount),
        memberId: form.memberId || undefined,
        counterpartyId: form.counterpartyId || undefined,
        bankAccountId: form.bankAccountId || undefined,
      };
      const send = (confirmOutsideAsaas: boolean) => fetch(editingId ? `/api/accounts/${editingId}` : '/api/accounts', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmOutsideAsaas ? { ...payload, confirmOutsideAsaas: true } : payload),
      });

      let response = await send(false);
      let data = await response.json();
      // Cobrança aberta no Asaas: a baixa é do Asaas. Só segue se foi recebido fora dele.
      if (response.status === 409 && data.code === 'ASAAS_CHARGE_OPEN') {
        const ok = await askConfirm({ title: 'Cobrança aberta no Asaas', message: data.error, confirmLabel: 'Recebido fora do Asaas' });
        if (!ok) return;
        response = await send(true);
        data = await response.json();
      }
      if (response.ok) {
        setMessage(data.asaasWarning ? { kind: 'error', text: data.asaasWarning } : { kind: 'ok', text: editingId ? 'Conta atualizada com sucesso.' : 'Conta cadastrada com sucesso.' });
        cancelEdit();
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? (editingId ? 'Erro ao atualizar conta.' : 'Erro ao cadastrar conta.') });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const account = accounts.find((a) => a.id === id);
    const ok = await askConfirm({
      title: 'Remover conta',
      message: account ? `Remover "${account.title}" (${account.type === 'RECEIVABLE' ? 'a receber' : 'a pagar'}, ${brl(account.amount)})? Esta ação não pode ser desfeita.` : 'Remover esta conta? Esta ação não pode ser desfeita.',
      confirmLabel: 'Remover',
      intent: 'danger',
    });
    if (!ok) return;

    const response = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage({ kind: 'ok', text: 'Conta removida.' });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao remover conta.' });
    }
  }

  async function handleApprove(id: string) {
    const response = await fetch(`/api/accounts/${id}/approve`, { method: 'POST' });
    const data = await response.json();
    if (response.ok) {
      setMessage({ kind: 'ok', text: 'Despesa aprovada.' });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao aprovar despesa.' });
    }
  }

  const filteredCharts = chartAccounts.filter((c) =>
    form.type === 'RECEIVABLE' ? c.type === 'REVENUE' : c.type === 'EXPENSE'
  );

  const q = search.trim().toLowerCase();
  const filteredAccounts = q
    ? accounts.filter((a) => a.title.toLowerCase().includes(q) || a.member?.name.toLowerCase().includes(q) || a.counterparty?.name.toLowerCase().includes(q) || a.status.toLowerCase().includes(q))
    : accounts;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Contas a receber e pagar</h1>
            <p className="mt-1 text-sm text-sand-dark">Registre o que a loja tem a receber e a pagar e acompanhe os vencimentos.</p>
          </div>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        {formOpen ? (
        <FormCard
          title={editingId ? 'Editar conta' : 'Lançamentos'}
          headerAction={editingId ? <button type="button" onClick={cancelEdit} className="rounded text-xs text-sand-dark outline-none hover:text-sand focus-visible:ring-2 focus-visible:ring-gold/60">Cancelar edição</button> : undefined}
        >
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-sand-dark">Detalhes</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <Field label="Categoria (plano de contas)">
                  <select value={form.chartAccountId} onChange={(e) => selectChart(e.target.value)} className={INPUT_CLASS}>
                    <option value="">Selecione…</option>
                    {filteredCharts.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Título da conta">
                  <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={INPUT_CLASS} required />
                </Field>
                <Field label="Tipo da conta">
                  <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className={INPUT_CLASS}>
                    <option value="RECEIVABLE">Conta a receber</option>
                    <option value="PAYABLE">Conta a pagar</option>
                  </select>
                </Field>
                <Field label="Valor">
                  <input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={INPUT_CLASS} required />
                </Field>
                <Field label="Data de vencimento">
                  <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className={INPUT_CLASS} required />
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className={INPUT_CLASS}>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Vencido</option>
                  </select>
                </Field>
                {form.status === 'paid' ? (
                  <Field label="Data do pagamento">
                    <input type="date" value={form.paidAt} onChange={(event) => setForm({ ...form, paidAt: event.target.value })} className={INPUT_CLASS} title="Data do pagamento (vazio = hoje)" />
                  </Field>
                ) : null}
              </div>
              {form.status === 'paid' ? (
                <p className="mt-2 text-xs text-sand-dark">Ao marcar como Pago, o pagamento é registrado na conta bancária/caixa escolhida abaixo e entra no saldo e no extrato. Data do pagamento em branco = hoje.</p>
              ) : null}
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-sand-dark">Vínculo e observações</h3>
              <div className="mt-3 grid gap-4">
                <Field label="Vincular a um membro">
                  <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value, counterpartyId: event.target.value ? '' : form.counterpartyId })} className={INPUT_CLASS}>
                    <option value="">Nenhum</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Vincular a um cliente/fornecedor">
                  <select value={form.counterpartyId} onChange={(event) => setForm({ ...form, counterpartyId: event.target.value, memberId: event.target.value ? '' : form.memberId })} className={INPUT_CLASS}>
                    <option value="">Nenhum</option>
                    {counterparties.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Conta bancária/caixa">
                  <select value={form.bankAccountId} onChange={(event) => setForm({ ...form, bankAccountId: event.target.value })} className={INPUT_CLASS} required={form.status === 'paid' && !editingId}>
                    <option value="">{form.status === 'paid' ? 'Conta bancária/caixa do pagamento (obrigatória)' : 'Conta bancária/caixa prevista (opcional)'}</option>
                    {financialAccounts.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </Field>
                {form.type === 'RECEIVABLE' && form.memberId ? (
                  <label className="flex items-center gap-2 text-sm text-sand-dark">
                    <input type="checkbox" checked={form.isDues} onChange={(event) => setForm({ ...form, isDues: event.target.checked })} />
                    É mensalidade do membro (conta para a regra do Art. 002 — 60 dias de inadimplência)
                  </label>
                ) : null}
                <Field label="Descrição">
                  <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={INPUT_CLASS} rows={3} />
                </Field>
              </div>
            </div>

            <Button type="submit" disabled={submitting}>{submitting ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Salvar conta'}</Button>
          </form>
        </FormCard>
        ) : null}

        <CollapsibleCard
          title="Contas cadastradas"
          count={accounts.length}
          defaultOpen={accounts.length > 0}
          headerAction={accounts.length > 0 ? <input aria-label="Buscar por título, membro ou status" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, membro ou status…" className={`${INPUT_CLASS} max-w-xs`} /> : undefined}
        >
          <div className="space-y-3">
            {accounts.length === 0 ? (
              <EmptyState title="Nenhum lançamento. O Livro está limpo." description="Lance a primeira conta a receber ou a pagar para acompanhar vencimentos e o fluxo de caixa." />
            ) : filteredAccounts.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhuma conta encontrada para &quot;{search}&quot;.</p>
            ) : filteredAccounts.map((account) => (
              <div key={account.id} className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/8">
                <div>
                  <p className="text-sm font-medium text-sand-light">
                    {account.title}
                    {account.isDues ? <span className="ml-2 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">Mensalidade</span> : null}
                    <span className={`ml-2 rounded-full border px-2 py-0.5 text-xs font-medium ${account.status === 'paid' ? 'border-emerald-500/20 bg-emerald-500/12 text-emerald-300' : account.status === 'overdue' ? 'border-rose-500/20 bg-rose-500/12 text-rose-300' : 'border-gold/15 bg-gold/10 text-gold'}`}>
                      {account.status === 'paid' ? (account.type === 'RECEIVABLE' ? 'Recebida' : 'Paga') : account.status === 'overdue' ? 'Vencida' : 'Em aberto'}
                    </span>
                    {account.awaitingAsaas && account.status !== 'paid' ? <span className="ml-2 rounded-full border border-sky-500/20 bg-sky-500/12 px-2 py-0.5 text-xs font-medium text-sky-200">Aguardando Asaas</span> : null}
                    {account.approvalStatus === 'pending' ? <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">Aguardando aprovação</span> : null}
                  </p>
                  <p className="mt-1 text-xs text-sand-dark">
                    {account.type === 'RECEIVABLE' ? 'Conta a receber' : 'Conta a pagar'} • {account.member?.name ?? account.counterparty?.name ?? 'Sem vínculo'}
                  </p>
                </div>
                <div className="min-w-28 text-right">
                  <p className={`text-sm font-medium tabular-nums ${account.type === 'RECEIVABLE' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {account.type === 'RECEIVABLE' ? '+' : '−'}{brl(account.amount)}
                  </p>
                  <p className="mt-0.5 text-xs text-sand-dark">{formatDateOnly(account.dueDate)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {account.approvalStatus === 'pending' && canApprove ? (
                    <button onClick={() => void handleApprove(account.id)} className="text-xs px-1 py-1 text-emerald-300 transition hover:text-emerald-200">Aprovar</button>
                  ) : null}
                  <button onClick={() => startEdit(account)} className="text-xs px-1 py-1 text-gold transition hover:text-gold-light">Editar</button>
                  <button onClick={() => void handleDelete(account.id)} className="text-xs px-1 py-1 text-rose-300 transition hover:text-rose-200">Remover</button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      </div>
    </main>
  );
}
