"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, EmptyState, Field, FormCard, inputClass, useConfirm } from '@/components/ui';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';

interface MemberOption { id: string; name: string; }
interface AccountOption { id: string; title: string; }
interface ChartOption { id: string; code: string; name: string; category: string | null; }
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
  asaasInvoiceUrl?: string | null;
  account?: AccountOption | null;
  member?: MemberOption | null;
}

interface HeldRecurring { memberId: string; memberName: string; pending: number; total: number; oldestDueDate: string }

interface CollectionInfo { mode: 'lodge' | 'asaas'; settlementName: string | null; balance: number | null; instructions: string | null }

export default function CobrancasClient({ invoices, chartAccounts, members, collection, heldRecurring }: { invoices: InvoiceItem[]; chartAccounts: ChartOption[]; members: MemberOption[]; collection: CollectionInfo; heldRecurring: HeldRecurring[] }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [releasingId, setReleasingId] = useState('');
  const [emittingId, setEmittingId] = useState('');
  const [asaasLinks, setAsaasLinks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ chartAccountId: '', memberId: '', number: '', amount: '', dueDate: '', description: '', isRecurring: false, recurringInterval: 'monthly', recurringCount: '' });
  const [bulk, setBulk] = useState({ chartAccountId: '', amount: '', dueDate: '', description: '', scope: 'active', isRecurring: false, recurringInterval: 'monthly', recurringCount: '' });
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [search, setSearch] = useState('');
  // Um formulário por vez e só sob demanda: a lista é o que o Tesoureiro usa todo dia.
  const [panel, setPanel] = useState<'none' | 'single' | 'bulk'>(invoices.length === 0 ? 'single' : 'none');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ kind: 'ok', text: 'Cobrança criada com sucesso.' });
        setPanel('none');
        setForm({ chartAccountId: '', memberId: '', number: '', amount: '', dueDate: '', description: '', isRecurring: false, recurringInterval: 'monthly', recurringCount: '' });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: data.error ?? 'Erro ao criar cobrança.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulk(event: FormEvent) {
    event.preventDefault();
    const alvo = bulk.scope === 'all' ? 'todos os membros' : 'todos os membros ativos';
    if (!(await askConfirm({ title: 'Cobrança em massa', message: `Gerar uma cobrança para ${alvo}?`, confirmLabel: 'Gerar' }))) return;
    setBulkProcessing(true);
    setMessage(null);
    const res = await fetch('/api/invoices/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...bulk, amount: Number(bulk.amount) }),
    });
    const data = await res.json();
    setBulkProcessing(false);
    if (res.ok) {
      setMessage({ kind: 'ok', text: `Cobranças geradas: ${data.created} (de ${data.members} membros).` });
      setPanel('none');
      setBulk({ chartAccountId: '', amount: '', dueDate: '', description: '', scope: 'active', isRecurring: false, recurringInterval: 'monthly', recurringCount: '' });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao gerar cobranças em massa.' });
    }
  }

  async function emitAsaas(invoiceId: string) {
    setEmittingId(invoiceId);
    setMessage(null);
    const res = await fetch('/api/asaas/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // O método (Pix/boleto) vem da configuração da loja — cartão fica fora.
      body: JSON.stringify({ invoiceId }),
    });
    const data = await res.json();
    setEmittingId('');
    if (res.ok) {
      const link = data.invoiceUrl ?? data.bankSlipUrl ?? '';
      if (link) setAsaasLinks((prev) => ({ ...prev, [invoiceId]: link }));
      setMessage({ kind: 'ok', text: 'Cobrança emitida no Asaas.' });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao emitir no Asaas.' });
    }
  }

  async function cancelInvoice(invoiceId: string) {
    if (!(await askConfirm({ title: 'Cancelar cobrança', message: 'Remove esta cobrança e o lançamento a receber gerado por ela (pagamentos já registrados são preservados).', confirmLabel: 'Cancelar cobrança', intent: 'danger' }))) return;
    const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? { kind: 'ok', text: 'Cobrança cancelada.' } : { kind: 'error', text: data.error ?? 'Erro ao cancelar.' });
    if (res.ok) router.refresh();
  }

  async function remindInvoice(invoiceId: string) {
    setMessage(null);
    const res = await fetch(`/api/invoices/${invoiceId}/remind`, { method: 'POST' });
    const data = await res.json();
    setMessage(res.ok ? { kind: 'ok', text: 'Lembrete enviado.' } : { kind: 'error', text: data.error ?? 'Erro ao enviar lembrete.' });
  }

  async function processRecurring() {
    setProcessing(true);
    setMessage(null);
    const res = await fetch('/api/cron/recurring-invoices', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao processar as recorrentes.' });
    } else {
      const partes = [`${data.processed} cobrança(s) recorrente(s) gerada(s)`];
      if (data.held > 0) partes.push(`${data.held} retida(s) por Art. 002 (aguardando liberação abaixo)`);
      if (data.locked > 0) partes.push(`${data.locked} em período já encerrado`);
      if (data.errors > 0) partes.push(`${data.errors} com erro`);
      setMessage({ kind: data.errors > 0 ? 'error' : 'ok', text: partes.join(' · ') + '.' });
    }
    setProcessing(false);
    router.refresh();
  }

  async function releaseHeld(row: HeldRecurring) {
    if (!(await askConfirm({
      title: 'Liberar recorrência',
      message: `Gerar de uma vez as ${row.pending} parcela(s) pendente(s) de ${row.memberName} (${brl(row.total)})? Faça isso depois de negociar com o irmão — as cobranças nascem com os vencimentos originais.`,
      confirmLabel: 'Gerar parcelas',
    }))) return;
    setReleasingId(row.memberId);
    setMessage(null);
    const res = await fetch(`/api/members/${row.memberId}/release-recurring`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setReleasingId('');
    setMessage(res.ok ? { kind: 'ok', text: `${data.generated} parcela(s) gerada(s) para ${row.memberName}.` } : { kind: 'error', text: data.error ?? 'Erro ao liberar a recorrência.' });
    if (res.ok) router.refresh();
  }

  const INPUT = inputClass; // fonte única do design system

  const q = search.trim().toLowerCase();
  const filteredInvoices = q
    ? invoices.filter((i) => i.number.toLowerCase().includes(q) || i.member?.name.toLowerCase().includes(q) || i.status.toLowerCase().includes(q))
    : invoices;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Cobranças</h1>
            <p className="mt-1 text-sm text-sand-dark">Gere cobranças simples e acompanhe o status das contas a receber.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => setPanel(panel === 'single' ? 'none' : 'single')}>{panel === 'single' ? 'Fechar' : 'Nova cobrança'}</Button>
            <Button type="button" variant="secondary" onClick={() => setPanel(panel === 'bulk' ? 'none' : 'bulk')}>{panel === 'bulk' ? 'Fechar' : 'Cobrança em massa'}</Button>
            <Button type="button" variant="secondary" onClick={processRecurring} disabled={processing} title="Gera as próximas ocorrências das cobranças recorrentes já cadastradas">
              {processing ? 'Processando…' : 'Processar recorrentes'}
            </Button>
          </div>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        {collection.mode === 'asaas' ? (
          <Card className="max-w-2xl">
            <h2 className="text-base font-semibold text-sand-light">Modo Asaas</h2>
            <p className="mt-1 text-xs text-sand-dark">
              As baixas caem na conta corrente <strong>{collection.settlementName ?? '— (escolha em Configurações da loja)'}</strong>. O repasse do Asaas para
              o banco é feito manualmente pelo Tesoureiro, no painel do Asaas. A tarifa cobrada pelo Asaas é lançada como despesa e absorvida pela loja.
            </p>
            {collection.balance != null ? (
              <p className="mt-3 text-sm text-sand-light">
                Saldo no Asaas, a repassar: <strong className="tabular-nums text-gold">{brl(collection.balance)}</strong>
                {collection.balance > 0 ? <span className="ml-2 text-xs text-sand-dark">— transfira para a conta corrente no painel do Asaas.</span> : null}
              </p>
            ) : (
              <p className="mt-3 text-xs text-sand-dark">Saldo do Asaas indisponível no momento.</p>
            )}
            {!collection.settlementName ? <Alert intent="warn" className="mt-3">Escolha a conta corrente de repasse em Configurações da loja para poder emitir no Asaas.</Alert> : null}
          </Card>
        ) : (
          <Card className="max-w-2xl">
            <h2 className="text-base font-semibold text-sand-light">Modo Loja — recebimento direto na conta da loja</h2>
            {collection.instructions ? (
              <p className="mt-2 whitespace-pre-line text-sm text-sand">{collection.instructions}</p>
            ) : (
              <p className="mt-2 text-xs text-amber-300">Cadastre a chave Pix e/ou os dados bancários da loja em Configurações da loja para orientar os pagamentos.</p>
            )}
            <p className="mt-2 text-xs text-sand-dark">Confirmado o pagamento, o Tesoureiro dá a baixa em Pagamentos.</p>
          </Card>
        )}

        {panel === 'bulk' ? (
        <FormCard title="Cobrança em massa" description="Gera uma cobrança para todos os irmãos de uma vez (ex.: mensalidade). O número de cada cobrança é gerado automaticamente.">
          <form onSubmit={handleBulk} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Categoria da cobrança">
                <select value={bulk.chartAccountId} onChange={(event) => setBulk({ ...bulk, chartAccountId: event.target.value })} className={INPUT} required>
                  <option value="">Selecione a categoria</option>
                  {chartAccounts.map((chart) => <option key={chart.id} value={chart.id}>{chart.code} — {chart.name}</option>)}
                </select>
              </Field>
              <Field label="Destinatários">
                <select value={bulk.scope} onChange={(event) => setBulk({ ...bulk, scope: event.target.value })} className={INPUT}>
                  <option value="active">Somente membros ativos</option>
                  <option value="all">Todos os membros</option>
                </select>
              </Field>
              <Field label="Valor por membro">
                <input type="number" step="0.01" value={bulk.amount} onChange={(event) => setBulk({ ...bulk, amount: event.target.value })} className={INPUT} required />
              </Field>
              <Field label="Vencimento">
                <input type="date" value={bulk.dueDate} onChange={(event) => setBulk({ ...bulk, dueDate: event.target.value })} className={INPUT} required />
              </Field>
              <Field label="Descrição" className="md:col-span-2">
                <textarea placeholder="ex.: Mensalidade de julho/2026" value={bulk.description} onChange={(event) => setBulk({ ...bulk, description: event.target.value })} className={`${INPUT} md:col-span-2`} rows={2} />
              </Field>
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-white/8 bg-sigma-blue-deep/60 px-4 py-2.5">
              <input type="checkbox" checked={bulk.isRecurring} onChange={(event) => setBulk({ ...bulk, isRecurring: event.target.checked })} className="accent-gold" />
              <span className="text-sm text-sand">Criar como cobrança recorrente para cada membro</span>
            </label>
            {bulk.isRecurring ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Repetir a cada">
                  <select value={bulk.recurringInterval} onChange={(event) => setBulk({ ...bulk, recurringInterval: event.target.value })} className={INPUT}>
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                  </select>
                </Field>
                <Field label="Qtde. de ocorrências">
                  <input type="number" min="1" value={bulk.recurringCount} onChange={(event) => setBulk({ ...bulk, recurringCount: event.target.value })} className={INPUT} />
                </Field>
              </div>
            ) : null}
            <Button type="submit" variant="secondary" disabled={bulkProcessing}>
              {bulkProcessing ? 'Gerando…' : 'Gerar para todos os membros'}
            </Button>
          </form>
        </FormCard>
        ) : null}

        {panel === 'single' ? (
        <FormCard title="Nova cobrança" description="Escolha a categoria (mensalidade, iniciação, elevação…) e o membro: o lançamento a receber é criado junto com a cobrança.">
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Categoria da cobrança">
                <select value={form.chartAccountId} onChange={(event) => setForm({ ...form, chartAccountId: event.target.value })} className={INPUT} required>
                  <option value="">Selecione a categoria</option>
                  {chartAccounts.map((chart) => <option key={chart.id} value={chart.id}>{chart.code} — {chart.name}</option>)}
                </select>
              </Field>
              <Field label="Membro a cobrar">
                <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} className={INPUT} required>
                  <option value="">Selecione o membro</option>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </Field>
              <Field label="Número / referência (gerado automaticamente se vazio)">
                <input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} className={INPUT} />
              </Field>
              <Field label="Valor">
                <input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={INPUT} required />
              </Field>
              <Field label="Vencimento">
                <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className={INPUT} required />
              </Field>
              <Field label="Descrição">
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={INPUT} rows={3} />
              </Field>
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-white/8 bg-sigma-blue-deep/60 px-4 py-2.5">
              <input type="checkbox" checked={form.isRecurring} onChange={(event) => setForm({ ...form, isRecurring: event.target.checked })} className="accent-gold" />
              <span className="text-sm text-sand">Criar como cobrança recorrente</span>
            </label>
            {form.isRecurring ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Repetir a cada">
                  <select value={form.recurringInterval} onChange={(event) => setForm({ ...form, recurringInterval: event.target.value })} className={INPUT}>
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                  </select>
                </Field>
                <Field label="Qtde. de ocorrências">
                  <input type="number" min="1" value={form.recurringCount} onChange={(event) => setForm({ ...form, recurringCount: event.target.value })} className={INPUT} />
                </Field>
              </div>
            ) : null}
            <Button type="submit" disabled={submitting}>{submitting ? 'Criando…' : 'Criar cobrança'}</Button>
          </form>
        </FormCard>
        ) : null}

        {heldRecurring.length > 0 ? (
          <Card>
            <h2 className="text-base font-semibold text-sand-light">Recorrências retidas — Art. 002</h2>
            <p className="mt-1 text-xs text-sand-dark">
              Estes irmãos estão enquadrados no Art. 002: a cobrança recorrente deles ficou parada e não gera parcelas sozinha. Depois de negociar, o Tesoureiro
              (ou o Venerável, se tiver permissão) libera e as parcelas pendentes são geradas de uma vez.
            </p>
            <div className="mt-4 space-y-2">
              {heldRecurring.map((row) => (
                <div key={row.memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-sand-light">{row.memberName}</p>
                    <p className="mt-0.5 text-xs text-sand-dark">
                      {row.pending} parcela(s) pendente(s) • {brl(row.total)} • a mais antiga venceu em {formatDateOnly(row.oldestDueDate)}
                    </p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => releaseHeld(row)} disabled={releasingId === row.memberId}>
                    {releasingId === row.memberId ? 'Gerando…' : 'Gerar parcelas pendentes'}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-sand-light">Cobranças cadastradas</h2>
            <input aria-label="Buscar por número, membro ou status" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número, membro ou status…" className={`${INPUT} max-w-xs`} />
          </div>
          <div className="mt-5 space-y-3">
            {invoices.length === 0 ? (
              <EmptyState title="Ainda não soou o malhete da arrecadação." description="Crie uma cobrança individual ou use a cobrança em massa para gerar as mensalidades de todos os irmãos." />
            ) : filteredInvoices.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhuma cobrança encontrada para &quot;{search}&quot;.</p>
            ) : filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/8">
                <div>
                  <p className="text-sm font-medium text-sand-light">{invoice.number}</p>
                  <p className="mt-1 text-xs text-sand-dark">{invoice.account?.title ?? 'Conta sem título'} • {invoice.member?.name ?? 'Sem membro'}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${invoice.status === 'paid' ? 'bg-emerald-500/12 text-emerald-300 border border-emerald-500/20' : invoice.status === 'billed' ? 'bg-sky-500/12 text-sky-200 border border-sky-500/20' : invoice.status === 'overdue' ? 'bg-rose-500/12 text-rose-300 border border-rose-500/20' : 'bg-gold/10 text-gold border border-gold/15'}`}>
                    {invoice.status === 'paid' ? 'Paga' : invoice.status === 'billed' ? 'Emitida' : invoice.status === 'overdue' ? 'Vencida' : 'Pendente'}
                  </span>
                </div>
                <div className="text-right text-xs text-sand-dark">
                  <p className="tabular-nums">{brl(invoice.amount)}</p>
                  <p className="mt-0.5">{formatDateOnly(invoice.dueDate)}</p>
                  {invoice.isRecurring ? (
                    <p className="mt-1 text-xs text-gold/70">Recorrente • {invoice.recurringInterval === 'quarterly' ? 'trimestral' : invoice.recurringInterval === 'yearly' ? 'anual' : 'mensal'}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                    {asaasLinks[invoice.id] ?? invoice.asaasInvoiceUrl ? (
                      <a href={asaasLinks[invoice.id] ?? invoice.asaasInvoiceUrl!} target="_blank" rel="noreferrer" className="text-xs text-gold hover:text-gold-light">Abrir cobrança</a>
                    ) : null}
                    {invoice.status !== 'paid' ? (
                      <>
                        {collection.mode === 'asaas' ? (
                        <button
                          onClick={() => emitAsaas(invoice.id)}
                          disabled={emittingId === invoice.id || !invoice.member}
                          title={!invoice.member ? 'Vincule a cobrança a um membro com CPF' : 'Emite boleto/Pix no Asaas da loja'}
                          className="rounded-full border border-gold/40 px-3 py-1 text-xs font-medium text-gold/80 transition-all duration-200 ease-out hover:border-gold/60 hover:text-gold disabled:opacity-40"
                        >
                          {emittingId === invoice.id ? 'Emitindo…' : invoice.status === 'billed' ? 'Reemitir' : 'Emitir no Asaas'}
                        </button>
                        ) : null}
                        <button onClick={() => void remindInvoice(invoice.id)} title="Envia um lembrete por e-mail ao membro" className="text-xs text-sand-dark transition hover:text-sand-light">Lembrar</button>
                        <button onClick={() => void cancelInvoice(invoice.id)} className="text-xs px-1 py-1 text-rose-300 transition hover:text-rose-200">Cancelar</button>
                      </>
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
