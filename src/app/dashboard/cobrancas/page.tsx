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
  const [emittingId, setEmittingId] = useState('');
  const [asaasLinks, setAsaasLinks] = useState<Record<string, string>>({});
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

  async function emitAsaas(invoiceId: string) {
    setEmittingId(invoiceId);
    setMessage('');
    const res = await fetch('/api/asaas/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, billingType: 'UNDEFINED' }),
    });
    const data = await res.json();
    setEmittingId('');
    if (res.ok) {
      const link = data.invoiceUrl ?? data.bankSlipUrl ?? '';
      if (link) setAsaasLinks((prev) => ({ ...prev, [invoiceId]: link }));
      setMessage('Cobrança emitida no Asaas.');
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao emitir no Asaas.');
    }
  }

  const INPUT = "w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20";

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-sand-light">Cobranças</h1>
          <p className="mt-1 text-sm text-sand-dark">Gere cobranças simples e acompanhe o status das contas a receber.</p>
        </div>

        {message ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-sand-light">Recorrência</h2>
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
              className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light disabled:opacity-40"
            >
              {processing ? 'Processando...' : 'Processar recorrentes'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Nova cobrança</h2>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
            <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} className={INPUT} required>
              <option value="">Selecione uma conta</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.title}</option>)}
            </select>
            <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} className={INPUT}>
              <option value="">Vincular a um membro</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} className={INPUT} placeholder="Número / referência" required />
            <input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={INPUT} placeholder="Valor" required />
            <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className={INPUT} required />
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={INPUT} placeholder="Descrição" rows={3} />
            <label className="flex items-center gap-3 rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 md:col-span-2">
              <input type="checkbox" checked={form.isRecurring} onChange={(event) => setForm({ ...form, isRecurring: event.target.checked })} className="accent-gold" />
              <span className="text-sm text-sand">Criar como cobrança recorrente</span>
            </label>
            <select value={form.recurringInterval} onChange={(event) => setForm({ ...form, recurringInterval: event.target.value })} className={INPUT} disabled={!form.isRecurring}>
              <option value="monthly">Mensal</option>
              <option value="quarterly">Trimestral</option>
              <option value="yearly">Anual</option>
            </select>
            <input type="number" min="1" value={form.recurringCount} onChange={(event) => setForm({ ...form, recurringCount: event.target.value })} className={INPUT} placeholder="Qtde. de ocorrências" disabled={!form.isRecurring} />
            <button type="submit" className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark md:col-span-2">Criar cobrança</button>
          </form>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Cobranças cadastradas</h2>
          <div className="mt-5 space-y-3">
            {loading ? <p className="text-sm text-sand-dark">Carregando...</p> : invoices.length === 0 ? <p className="text-sm text-sand-dark">Nenhuma cobrança cadastrada.</p> : invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/[8%]">
                <div>
                  <p className="text-sm font-medium text-sand-light">{invoice.number}</p>
                  <p className="mt-1 text-xs text-sand-dark">{invoice.account?.title ?? 'Conta sem título'} • {invoice.member?.name ?? 'Sem membro'}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${invoice.status === 'paid' ? 'bg-emerald-500/12 text-emerald-300 border border-emerald-500/20' : invoice.status === 'billed' ? 'bg-sky-500/12 text-sky-200 border border-sky-500/20' : invoice.status === 'overdue' ? 'bg-rose-500/12 text-rose-300 border border-rose-500/20' : 'bg-gold/10 text-gold border border-gold/15'}`}>
                    {invoice.status === 'paid' ? 'Paga' : invoice.status === 'billed' ? 'Emitida' : invoice.status === 'overdue' ? 'Vencida' : 'Pendente'}
                  </span>
                </div>
                <div className="text-right text-xs text-sand-dark">
                  <p className="tabular-nums">R$ {invoice.amount.toFixed(2)}</p>
                  <p className="mt-0.5">{new Date(invoice.dueDate).toLocaleDateString('pt-BR')}</p>
                  {invoice.isRecurring ? (
                    <p className="mt-1 text-xs text-gold/70">Recorrente • {invoice.recurringInterval === 'quarterly' ? 'trimestral' : invoice.recurringInterval === 'yearly' ? 'anual' : 'mensal'}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                    {asaasLinks[invoice.id] ? (
                      <a href={asaasLinks[invoice.id]} target="_blank" rel="noreferrer" className="text-xs text-gold hover:text-gold-light">Abrir cobrança</a>
                    ) : null}
                    {invoice.status !== 'paid' ? (
                      <button
                        onClick={() => emitAsaas(invoice.id)}
                        disabled={emittingId === invoice.id || !invoice.member}
                        title={!invoice.member ? 'Vincule a cobrança a um membro com CPF' : 'Emite boleto/Pix no Asaas da loja'}
                        className="rounded-full border border-gold/40 px-3 py-1 text-xs font-medium text-gold/80 transition-all duration-200 ease-out hover:border-gold/60 hover:text-gold disabled:opacity-40"
                      >
                        {emittingId === invoice.id ? 'Emitindo…' : invoice.status === 'billed' ? 'Reemitir' : 'Emitir no Asaas'}
                      </button>
                    ) : null}
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

