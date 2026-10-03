"use client";

import { FormEvent, useState } from 'react';
import { occurrenceDescriptionsPreview, recurrenceSummary } from '@/lib/recurring-rules';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, EmptyState, Field, FormCard, inputClass, useConfirm, Toast } from '@/components/ui';
import { fetchWhatsAppShare, WhatsAppSendDialog, type WhatsAppShare } from '@/components/whatsapp-send-dialog';
import { fetchReceiptContext, RegisterReceiptDialog, type ReceiptContext } from '@/components/register-receipt-dialog';
import { ChargeReminderDialog } from '@/components/charge-reminder-dialog';
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
  openBalance: number;
  overdue: boolean;
}

interface OpenSummary { invoices: number; members: number; total: number; overdue: number; withoutEmail: number }

type ListFilter = 'open' | 'overdue' | 'paid' | 'all';


interface CollectionInfo { mode: 'lodge' | 'asaas'; settlementName: string | null; balance: number | null; instructions: string | null }

export default function CobrancasClient({ invoices, chartAccounts, members, collection, openSummary }: { invoices: InvoiceItem[]; chartAccounts: ChartOption[]; members: MemberOption[]; collection: CollectionInfo; openSummary: OpenSummary }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [emittingId, setEmittingId] = useState('');
  const [asaasLinks, setAsaasLinks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ chartAccountId: '', memberId: '', number: '', amount: '', dueDate: '', description: '', isRecurring: false, recurringInterval: 'monthly', recurringCount: '' });
  const [bulk, setBulk] = useState({ chartAccountId: '', amount: '', dueDate: '', description: '', scope: 'active', isRecurring: false, recurringInterval: 'monthly', recurringCount: '' });
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [search, setSearch] = useState('');
  // Lista abre nas cobranças em aberto (o que o Tesoureiro acompanha no dia a dia).
  const [listFilter, setListFilter] = useState<ListFilter>('open');
  const [reminderOpen, setReminderOpen] = useState(false);
  // Envio pelo WhatsApp (só Modo Loja): diálogo da cobrança e atalho logo após criar uma avulsa.
  const [share, setShare] = useState<WhatsAppShare | null>(null);
  const [sharingId, setSharingId] = useState('');
  const [justCreated, setJustCreated] = useState<{ id: string; number: string } | null>(null);
  const lodgeMode = collection.mode === 'lodge';
  // Comprovante recebido fora do portal (ex.: WhatsApp), registrado pela Tesouraria.
  const [receiptCtx, setReceiptCtx] = useState<ReceiptContext | null>(null);
  const [receiptLoadingId, setReceiptLoadingId] = useState('');
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
        setJustCreated(lodgeMode && data.item?.member ? { id: data.item.id, number: data.item.number } : null);
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

  async function openWhatsApp(invoiceId: string) {
    setSharingId(invoiceId);
    setMessage(null);
    const result = await fetchWhatsAppShare(invoiceId);
    setSharingId('');
    if (result.ok) setShare(result.share);
    else setMessage({ kind: 'error', text: result.error });
  }

  async function openReceipt(invoiceId: string) {
    setReceiptLoadingId(invoiceId);
    setMessage(null);
    const result = await fetchReceiptContext(invoiceId);
    setReceiptLoadingId('');
    if (result.ok) setReceiptCtx(result.ctx);
    else setMessage({ kind: 'error', text: result.error });
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
      if (data.held > 0) partes.push(`${data.held} retida(s) por bloqueio do irmão (comunicado à Potência)`);
      if (data.locked > 0) partes.push(`${data.locked} em período já encerrado`);
      if (data.errors > 0) partes.push(`${data.errors} com erro`);
      // Emissão automática no Asaas (só quando a loja ligou a opção).
      const ae = data.autoEmit as { emitted: number; skippedNoCpf: number; errors: number } | null;
      if (ae) {
        partes.push(`${ae.emitted} emitida(s) automaticamente no Asaas`);
        if (ae.skippedNoCpf > 0) partes.push(`${ae.skippedNoCpf} sem emitir por falta de CPF do irmão`);
        if (ae.errors > 0) partes.push(`${ae.errors} falha(s) na emissão`);
      }
      const failed = data.errors > 0 || (ae?.errors ?? 0) > 0;
      setMessage({ kind: failed ? 'error' : 'ok', text: partes.join(' · ') + '.' });
    }
    setProcessing(false);
    router.refresh();
  }

  const INPUT = inputClass; // fonte única do design system

  const q = search.trim().toLowerCase();
  const isOpen = (i: InvoiceItem) => i.status !== 'paid' && i.openBalance > 0;
  const matchesFilter: Record<ListFilter, (i: InvoiceItem) => boolean> = {
    open: isOpen,
    overdue: (i) => isOpen(i) && i.overdue,
    paid: (i) => !isOpen(i),
    all: () => true,
  };
  const filterCounts = Object.fromEntries((Object.keys(matchesFilter) as ListFilter[]).map((k) => [k, invoices.filter(matchesFilter[k]).length])) as Record<ListFilter, number>;
  const filteredInvoices = invoices
    .filter(matchesFilter[listFilter])
    .filter((i) => !q || i.number.toLowerCase().includes(q) || i.member?.name.toLowerCase().includes(q) || (i.account?.title ?? '').toLowerCase().includes(q));
  const FILTERS: { value: ListFilter; label: string }[] = [
    { value: 'open', label: 'Em aberto' },
    { value: 'overdue', label: 'Vencidas' },
    { value: 'paid', label: 'Pagas' },
    { value: 'all', label: 'Todas' },
  ];

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

        <Toast message={message} onClose={() => setMessage(null)} />
        {justCreated ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-sigma-blue-deep/60 px-4 py-3 text-sm text-sand">
            <span>Enviar a cobrança {justCreated.number} ao irmão pelo WhatsApp?</span>
            <Button type="button" size="sm" onClick={() => { const id = justCreated.id; setJustCreated(null); void openWhatsApp(id); }} disabled={sharingId === justCreated.id}>Enviar pelo WhatsApp</Button>
            <button type="button" onClick={() => setJustCreated(null)} className="text-xs text-sand-dark transition hover:text-sand-light">Agora não</button>
          </div>
        ) : null}

        {/* Como os irmãos pagam — faixa compacta; os detalhes ficam em Configurações da loja. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/8 bg-sigma-blue-deep/50 px-4 py-2.5 text-xs text-sand-dark">
          {collection.mode === 'asaas' ? (
            <>
              <span className="font-semibold text-sand-light">Modo Asaas</span>
              <span title="O repasse do Asaas para o banco é manual, no painel do Asaas. A tarifa é lançada como despesa da loja.">
                Baixas na conta <strong className="text-sand">{collection.settlementName ?? '— escolha em Configurações da loja'}</strong>
              </span>
              {collection.balance != null ? (
                <span>Saldo no Asaas a repassar: <strong className="tabular-nums text-gold">{brl(collection.balance)}</strong></span>
              ) : (
                <span>Saldo do Asaas indisponível no momento.</span>
              )}
            </>
          ) : (
            <>
              <span className="font-semibold text-sand-light">Modo Loja</span>
              {collection.instructions ? (
                <span className="text-sand">{collection.instructions.split('\n').join(' · ')}</span>
              ) : (
                <span className="text-amber-300">Cadastre a chave Pix e/ou os dados bancários em Configurações da loja.</span>
              )}
              <span>Baixa manual em Pagamentos.</span>
            </>
          )}
        </div>
        {collection.mode === 'asaas' && !collection.settlementName ? <Alert intent="warn">Escolha a conta corrente de repasse em Configurações da loja para poder emitir no Asaas.</Alert> : null}

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
                <input type="number" inputMode="decimal" step="0.01" value={bulk.amount} onChange={(event) => setBulk({ ...bulk, amount: event.target.value })} className={INPUT} required />
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
                <Field label="Repetições depois da primeira">
                  <input type="number" inputMode="numeric" min="1" value={bulk.recurringCount} onChange={(event) => setBulk({ ...bulk, recurringCount: event.target.value })} className={INPUT} placeholder="em branco = sem fim" />
                  <span className="mt-1.5 block text-xs text-gold/80">{recurrenceSummary(bulk.dueDate, bulk.recurringInterval, bulk.recurringCount)}</span>
                  {(() => { const next = occurrenceDescriptionsPreview(bulk.description, bulk.dueDate, bulk.recurringInterval, bulk.recurringCount); return next.length ? <span className="mt-1 block text-xs text-sand-dark">Próximas descrições: {next.join(" · ")}{bulk.recurringCount.trim() === "" || Number(bulk.recurringCount) > next.length ? " …" : ""}</span> : <span className="mt-1 block text-xs text-sand-dark">Dica: escreva o mês na descrição (ex.: &quot;Mensalidade de setembro&quot;) ou use {"{mês}"} — cada repetição sai com o mês dela.</span>; })()}
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
                <input type="number" inputMode="decimal" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={INPUT} required />
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
                <Field label="Repetições depois da primeira">
                  <input type="number" inputMode="numeric" min="1" value={form.recurringCount} onChange={(event) => setForm({ ...form, recurringCount: event.target.value })} className={INPUT} placeholder="em branco = sem fim" />
                  <span className="mt-1.5 block text-xs text-gold/80">{recurrenceSummary(form.dueDate, form.recurringInterval, form.recurringCount)}</span>
                  {(() => { const next = occurrenceDescriptionsPreview(form.description, form.dueDate, form.recurringInterval, form.recurringCount); return next.length ? <span className="mt-1 block text-xs text-sand-dark">Próximas descrições: {next.join(" · ")}{form.recurringCount.trim() === "" || Number(form.recurringCount) > next.length ? " …" : ""}</span> : <span className="mt-1 block text-xs text-sand-dark">Dica: escreva o mês na descrição (ex.: &quot;Mensalidade de setembro&quot;) ou use {"{mês}"} — cada repetição sai com o mês dela.</span>; })()}
                </Field>
              </div>
            ) : null}
            <Button type="submit" disabled={submitting}>{submitting ? 'Criando…' : 'Criar cobrança'}</Button>
          </form>
        </FormCard>
        ) : null}

        {openSummary.invoices > 0 ? (
          <section aria-labelledby="cobrar-title" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gold/20 bg-sigma-card px-6 py-5">
            <div>
              <h2 id="cobrar-title" className="text-base font-semibold text-sand-light">Cobrar quem está em aberto</h2>
              <p className="mt-1 text-sm text-sand">
                <strong className="tabular-nums text-sand-light">{openSummary.invoices}</strong> cobrança(s) de <strong className="tabular-nums text-sand-light">{openSummary.members}</strong> irmão(s) ·{' '}
                <strong className="tabular-nums text-gold">{brl(openSummary.total)}</strong>
                {openSummary.overdue > 0 ? <> · <span className="text-rose-300">{openSummary.overdue} vencida(s)</span></> : null}
              </p>
              {openSummary.withoutEmail > 0 ? <p className="mt-0.5 text-xs text-sand-dark">{openSummary.withoutEmail} irmão(s) sem e-mail cadastrado não recebem o lembrete por e-mail.</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => setReminderOpen(true)} title="Um e-mail por irmão com todas as cobranças em aberto dele — você confere a lista antes de enviar">
                Enviar lembretes por e-mail
              </Button>
              {lodgeMode ? (
                <Link href="/dashboard/cobrancas/whatsapp" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-sigma-blue-mid/30 px-5 py-2.5 text-sm text-sand-light transition-all duration-200 ease-out hover:bg-sigma-blue-mid/50">
                  Envio pelo WhatsApp
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-sand-light">Cobranças cadastradas</h2>
            <input aria-label="Buscar por número, membro ou descrição" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número, membro ou descrição…" className={`${INPUT} max-w-xs`} />
          </div>
          {invoices.length > 0 ? (
            <div role="group" aria-label="Filtrar cobranças" className="mt-4 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={listFilter === f.value}
                  onClick={() => setListFilter(f.value)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${listFilter === f.value ? 'border-gold/60 bg-gold/15 text-gold' : 'border-white/10 text-sand-dark hover:text-sand-light'}`}
                >
                  {f.label} <span className="tabular-nums opacity-70">{filterCounts[f.value]}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-5 space-y-3">
            {invoices.length === 0 ? (
              <EmptyState title="Ainda não soou o malhete da arrecadação." description="Crie uma cobrança individual ou use a cobrança em massa para gerar as mensalidades de todos os irmãos." />
            ) : filteredInvoices.length === 0 ? (
              <p className="text-sm text-sand-dark">{q ? <>Nenhuma cobrança encontrada para &quot;{search}&quot; neste filtro.</> : 'Nenhuma cobrança neste filtro.'}</p>
            ) : filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/8">
                <div>
                  <p className="text-sm font-medium text-sand-light">{invoice.number}</p>
                  <p className="mt-1 text-xs text-sand-dark">{invoice.account?.title ?? 'Conta sem título'} • {invoice.member?.name ?? 'Sem membro'}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${invoice.status === 'paid' ? 'bg-emerald-500/12 text-emerald-300 border border-emerald-500/20' : invoice.status === 'billed' ? 'bg-sky-500/12 text-sky-200 border border-sky-500/20' : invoice.status === 'overdue' || invoice.overdue ? 'bg-rose-500/12 text-rose-300 border border-rose-500/20' : 'bg-gold/10 text-gold border border-gold/15'}`}>
                    {invoice.status === 'paid' ? 'Paga' : invoice.status === 'overdue' || invoice.overdue ? 'Vencida' : invoice.status === 'billed' ? 'Emitida' : 'Pendente'}
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
                        {lodgeMode && invoice.member ? (
                          <button onClick={() => void openWhatsApp(invoice.id)} disabled={sharingId === invoice.id} title="Abre a conversa do irmão no WhatsApp com a cobrança e o Pix copia e cola" className="text-xs text-emerald-300 transition hover:text-emerald-200 disabled:opacity-40">
                            {sharingId === invoice.id ? 'Preparando…' : 'WhatsApp'}
                          </button>
                        ) : null}
                        {lodgeMode && invoice.member ? (
                          <button onClick={() => void openReceipt(invoice.id)} disabled={receiptLoadingId === invoice.id} title="O irmão mandou o comprovante por fora (ex.: WhatsApp): registre em nome dele para conferência e baixa" className="text-xs text-sky-300 transition hover:text-sky-200 disabled:opacity-40">
                            {receiptLoadingId === invoice.id ? 'Abrindo…' : 'Registrar comprovante'}
                          </button>
                        ) : null}
                        <button onClick={() => void remindInvoice(invoice.id)} title="Envia um lembrete por e-mail ao membro" className="text-xs text-sand-dark transition hover:text-sand-light">Lembrar por e-mail</button>
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
      {share ? <WhatsAppSendDialog key={share.key} share={share} onClose={() => setShare(null)} /> : null}
      {reminderOpen ? <ChargeReminderDialog onClose={() => setReminderOpen(false)} /> : null}
      {receiptCtx ? <RegisterReceiptDialog key={receiptCtx.invoiceId} ctx={receiptCtx} onClose={() => setReceiptCtx(null)} onDone={() => { setReceiptCtx(null); router.refresh(); }} /> : null}
    </main>
  );
}
