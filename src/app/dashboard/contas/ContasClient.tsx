"use client";

import { FormEvent, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, CollapsibleCard, EmptyState, Field, FormCard, inputClass, useConfirm, Toast } from '@/components/ui';
import { brl } from '@/lib/currency';
import { MemberLink, useQuickNav } from '@/components/quick-nav';
import AccountsFilterBar, { FilterSummary } from '@/components/accounts-filter-bar';
import AccountsReport from '@/components/accounts-report';
import { applyFilters, describeFilters, isDefaultFilters, parseFilters, serializeFilters, type Filters, type FilterAccount } from '@/lib/accounts-filter';
import { receiptUploadError } from '@/lib/upload-guards';
import { daysOverdueBR, formatDateOnly, todayBR } from '@/lib/date-only';

interface ChartAccountOption { id: string; code: string; name: string; type: string; isDues?: boolean; }
interface MemberOption { id: string; name: string; }
interface CounterpartyOption { id: string; name: string; kind: string; }
interface FinancialAccountOption { id: string; name: string; kind: string; }
// Vencida = não paga e com o vencimento (dia civil de Brasília) já passado. O status gravado quase nunca vira "overdue".
const isOverdue = (a: { status: string; dueDate: string }) => a.status === 'overdue' || (a.status !== 'paid' && daysOverdueBR(a.dueDate) > 0);

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
  /** Aprovação da despesa: o que o usuário logado pode fazer e, com a dupla aprovação, quem já aprovou/quem falta. */
  approval?: { canApprove: boolean; canValve: boolean; summary: string | null };
  hasReceipt?: boolean;
  /** Comprovantes de pagamento, um por baixa de despesa. */
  proofs?: { paymentId: string; label: string }[];
  awaitingAsaas?: boolean;
  paid?: number;
  chartAccountId?: string | null;
  chartName?: string | null;
  personHidden?: boolean;
  member?: MemberOption | null;
  counterparty?: CounterpartyOption | null;
  bankAccount?: FinancialAccountOption | null;
}

const INPUT_CLASS = inputClass; // fonte única do design system

export default function ContasClient({ accounts, members, chartAccounts, counterparties, financialAccounts, startWithForm = false, art002Enabled = true, lodgeName = 'Loja', crestUrl = null, issuedBy = null }: { accounts: AccountItem[]; members: MemberOption[]; chartAccounts: ChartAccountOption[]; counterparties: CounterpartyOption[]; financialAccounts: FinancialAccountOption[]; role: string; startWithForm?: boolean; art002Enabled?: boolean; lodgeName?: string; crestUrl?: string | null; issuedBy?: string | null }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Mensalidade (Art. 002) vem marcada por padrão quando a loja aplica o Art. 002 em Configurações;
  // com ele desligado, vem desmarcada. A categoria escolhida ajusta (só Mensalidades conta).
  const emptyForm = () => ({ title: '', type: 'RECEIVABLE', chartAccountId: '', amount: '', dueDate: '', status: 'pending', description: '', memberId: '', counterpartyId: '', bankAccountId: '', isDues: art002Enabled, paidAt: '' });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Comprovante da baixa (despesa lançada/editada como Paga): obrigatório; sobe ANTES, e a baixa leva a referência.
  // `fileKey` zera o campo de arquivo.
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  // O formulário de lançamento abre pelo item "Lançamento" do menu (startWithForm) — e fica aberto
  // entre um lançamento e outro. Em /contas (só a lista) abre ao editar uma conta; sem contas ainda, já vem aberto.
  const [formOpen, setFormOpen] = useState(startWithForm || accounts.length === 0);
  const [search, setSearch] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  // Filtros novos (navegação rápida ligada): estado na URL, sem recarregar a página (history.replaceState).
  const { enabled: betaOn } = useQuickNav();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => parseFilters(searchParams));
  // Quem chega por um link já filtrado (ex.: "Contas vencidas" da Visão geral) vê a barra de filtros mesmo sem a navegação rápida ligada.
  const [arrivedFiltered] = useState(() => !isDefaultFilters(parseFilters(searchParams)));
  const newFilters = betaOn || arrivedFiltered;
  const today = useMemo(() => todayBR(), []);
  const filterRows = useMemo<FilterAccount[]>(() => accounts.map((a) => ({
    id: a.id, title: a.title, type: a.type, amount: a.amount, paid: a.paid ?? 0, dueDate: a.dueDate, status: a.status, isDues: a.isDues,
    description: a.description ?? null, chartAccountId: a.chartAccountId ?? null, chartName: a.chartName ?? null, bankAccountId: a.bankAccount?.id ?? null,
    personId: a.personHidden ? null : (a.member?.id ?? a.counterparty?.id ?? null), personName: a.member?.name ?? a.counterparty?.name ?? null,
  })), [accounts]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const personOptions = useMemo(() => [...members, ...counterparties].map((p) => ({ id: p.id, name: p.name })).sort((x, y) => x.name.localeCompare(y.name, 'pt-BR')), [members, counterparties]);
  const shownRows = useMemo(() => (newFilters ? applyFilters(filterRows, filters, today) : []), [newFilters, filterRows, filters, today]);

  function changeFilters(next: Filters) {
    setFilters(next);
    try {
      const params = new URLSearchParams(window.location.search);
      for (const k of ['tipo', 'sit', 'amin', 'amax', 'de', 'ate', 'pessoa', 'cat', 'conta', 'mens', 'min', 'max', 'q', 'ord']) params.delete(k);
      const mine = serializeFilters(next);
      const qs = [params.toString(), mine].filter(Boolean).join('&');
      window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
    } catch {}
  }

  function startEdit(account: AccountItem) {
    setEditingId(account.id);
    setFormOpen(true);
    setForm({
      title: account.title,
      type: account.type,
      chartAccountId: account.chartAccountId ?? '',
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
    setReceiptFile(null);
    setFileKey((k) => k + 1);
    setEditingId(null);
    setFormOpen(startWithForm);
    setForm(emptyForm());
  }

  // Lançamento de mensalidade (categoria de mensalidade; na edição, conta já marcada): exige o irmão.
  const chosenChart = chartAccounts.find((c) => c.id === form.chartAccountId);
  const duesEntry = form.type === 'RECEIVABLE' && (chosenChart ? Boolean(chosenChart.isDues) : Boolean(editingId) && form.isDues);

  function selectChart(id: string) {
    const chart = chartAccounts.find((c) => c.id === id);
    if (chart) {
      setForm((prev) => ({ ...prev, chartAccountId: id, title: chart.name, type: chart.type === 'REVENUE' ? 'RECEIVABLE' : 'PAYABLE', bankAccountId: prev.bankAccountId, isDues: art002Enabled && Boolean(chart.isDues) }));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Despesa que passa a paga agora (nova baixa): sem comprovante, não salva. Conta já quitada (só edição de dados) não pede.
    const editing = editingId ? accounts.find((a) => a.id === editingId) : null;
    const needsProof = form.type === 'PAYABLE' && form.status === 'paid' && !(editing && editing.status === 'paid');
    if (needsProof) {
      if (!receiptFile) { setMessage({ kind: 'error', text: 'Anexe o comprovante do pagamento (PDF ou foto): toda baixa de despesa precisa dele.' }); return; }
      const invalid = receiptUploadError(receiptFile);
      if (invalid) { setMessage({ kind: 'error', text: invalid }); return; }
    }
    setSubmitting(true);
    try {
      let proofRef: { key: string; name: string; type: string } | null = null;
      if (needsProof && receiptFile) {
        const fd = new FormData();
        fd.append('file', receiptFile);
        const up = await fetch('/api/payment-proofs', { method: 'POST', body: fd });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) { setMessage({ kind: 'error', text: upData.error ?? 'Não foi possível enviar o comprovante.' }); return; }
        proofRef = upData.proof;
      }
      // A categoria vem pré-carregada na edição (startEdit), então o que está no form é o que vale.
      const payload = {
        ...form,
        amount: Number(form.amount),
        // A caixa só aparece em conta a receber de um irmão: fora disso, nunca é mensalidade.
        isDues: form.isDues && form.type === 'RECEIVABLE' && Boolean(form.memberId),
        memberId: form.memberId || undefined,
        counterpartyId: form.counterpartyId || undefined,
        bankAccountId: form.bankAccountId || undefined,
        ...(proofRef ? { proofKey: proofRef.key, proofName: proofRef.name, proofType: proofRef.type } : {}),
      };
      const send = (confirmOutsideAsaas: boolean) => fetch(editingId ? `/api/accounts/${editingId}` : '/api/accounts', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmOutsideAsaas ? { ...payload, confirmOutsideAsaas: true } : payload),
      });

      let response = await send(false);
      let data = await response.json().catch(() => ({}));
      // Cobrança aberta no Asaas: a baixa é do Asaas. Só segue se foi recebido fora dele.
      if (response.status === 409 && data.code === 'ASAAS_CHARGE_OPEN') {
        const ok = await askConfirm({ title: 'Cobrança aberta no Asaas', message: data.error, confirmLabel: 'Recebido fora do Asaas' });
        if (!ok) return;
        response = await send(true);
        data = await response.json().catch(() => ({}));
      }
      if (response.ok) {
        const savedText = editingId ? 'Conta atualizada com sucesso.' : 'Conta cadastrada com sucesso.';
        setMessage(
          data.asaasWarning ? { kind: 'error', text: data.asaasWarning }
          : { kind: 'ok', text: proofRef ? `${savedText} Comprovante anexado.` : savedText },
        );
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

  // Comprovante de pagamento da despesa: anexar/trocar (PDF ou foto) e remover.
  async function handleReceiptFile(id: string, file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`/api/accounts/${id}/receipt`, { method: 'POST', body });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage({ kind: 'ok', text: 'Comprovante anexado.' });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao anexar o comprovante.' });
    }
  }

  async function handleReceiptRemove(id: string) {
    const ok = await askConfirm({ title: 'Remover comprovante', message: 'Remover o comprovante anexado a esta despesa?', confirmLabel: 'Remover', intent: 'danger' });
    if (!ok) return;
    const response = await fetch(`/api/accounts/${id}/receipt`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage({ kind: 'ok', text: 'Comprovante removido.' });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao remover o comprovante.' });
    }
  }

  async function handleApprove(id: string, valve = false) {
    if (valve) {
      const ok = await askConfirm({ title: 'Aprovar sozinho', message: 'Sua aprovação valerá pelo Venerável e pelo Tesoureiro. Use quando o Venerável não puder aprovar; fica registrado na auditoria.', confirmLabel: 'Aprovar sozinho' });
      if (!ok) return;
    }
    const response = await fetch(`/api/accounts/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valve }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage({ kind: 'ok', text: data.complete === false ? `Sua aprovação foi registrada. ${data.summary ?? ''}` : 'Despesa aprovada.' });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao aprovar despesa.' });
    }
  }

  const filteredCharts = chartAccounts.filter((c) =>
    form.type === 'RECEIVABLE' ? c.type === 'REVENUE' : c.type === 'EXPENSE'
  );

  const q = search.trim().toLowerCase();
  const filteredAccounts = newFilters
    ? shownRows.map((r) => accountById.get(r.id)!).filter(Boolean)
    : q
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

        <Toast message={message} onClose={() => setMessage(null)} />

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
                  <input type="number" inputMode="decimal" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={INPUT_CLASS} required />
                </Field>
                <Field label="Data de vencimento">
                  <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className={INPUT_CLASS} required />
                </Field>
                <Field label="Situação">
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
                <Field label={duesEntry ? 'Vincular a um membro (obrigatório na mensalidade)' : 'Vincular a um membro'}>
                  <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value, counterpartyId: event.target.value ? '' : form.counterpartyId })} className={INPUT_CLASS} required={duesEntry}>
                    <option value="">{duesEntry ? 'Selecione o irmão…' : 'Nenhum'}</option>
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
                    {!art002Enabled ? <span className="text-xs text-sand-dark/70">· Art. 002 desligado em Configurações</span> : null}
                  </label>
                ) : null}
                {form.type === 'PAYABLE' && form.status === 'paid' ? (
                  <Field label="Comprovante do pagamento (obrigatório)">
                    <input key={fileKey} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} className={INPUT_CLASS} />
                    <p className="mt-1 text-xs text-sand-dark">PDF ou foto, até 4 MB. Toda baixa de despesa leva o seu comprovante; sem ele a conta não é salva como paga. Para só registrar a despesa, deixe como Pendente e dê a baixa depois.</p>
                  </Field>
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
          count={newFilters ? filteredAccounts.length : accounts.length}
          defaultOpen={accounts.length > 0}
          headerAction={accounts.length > 0 && !newFilters ? <input aria-label="Buscar por título, membro ou status" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, membro ou status…" className={`${INPUT_CLASS} max-w-xs`} /> : undefined}
        >
          <div className="space-y-3">
            {newFilters && accounts.length > 0 ? (
              <div className="space-y-3 pb-2">
                <AccountsFilterBar
                  accounts={filterRows}
                  filters={filters}
                  onChange={changeFilters}
                  today={today}
                  people={personOptions}
                  categories={chartAccounts.map((c) => ({ id: c.id, name: `${c.code} ${c.name}` }))}
                  banks={financialAccounts.map((b) => ({ id: b.id, name: b.name }))}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <FilterSummary rows={shownRows} />
                  <button type="button" onClick={() => setReportOpen((v) => !v)} aria-expanded={reportOpen} className="rounded-full border border-gold/40 px-4 py-1.5 text-xs font-medium text-gold hover:text-gold-light">{reportOpen ? 'Fechar relatório' : 'Relatório / Imprimir'}</button>
                </div>
              </div>
            ) : null}
            {accounts.length === 0 ? (
              <EmptyState title="Nenhum lançamento. O Livro está limpo." description="Lance a primeira conta a receber ou a pagar para acompanhar vencimentos e o fluxo de caixa." />
            ) : filteredAccounts.length === 0 ? (
              <p className="text-sm text-sand-dark">{newFilters && !isDefaultFilters(filters) ? 'Nenhuma conta com esses filtros. Tire algum filtro ou use “limpar filtros”.' : `Nenhuma conta encontrada para “${search}”.`}</p>
            ) : filteredAccounts.map((account) => (
              <div key={account.id} className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/8">
                <div>
                  <p className="text-sm font-medium text-sand-light">
                    {account.title}
                    {account.isDues ? <span className="ml-2 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">Mensalidade</span> : null}
                    <span className={`ml-2 rounded-full border px-2 py-0.5 text-xs font-medium ${account.status === 'paid' ? 'border-emerald-500/20 bg-emerald-500/12 text-emerald-300' : isOverdue(account) ? 'border-rose-500/20 bg-rose-500/12 text-rose-300' : 'border-gold/15 bg-gold/10 text-gold'}`}>
                      {account.status === 'paid' ? (account.type === 'RECEIVABLE' ? 'Recebida' : 'Paga') : isOverdue(account) ? 'Vencida' : 'Em aberto'}
                    </span>
                    {account.awaitingAsaas && account.status !== 'paid' ? <span className="ml-2 rounded-full border border-sky-500/20 bg-sky-500/12 px-2 py-0.5 text-xs font-medium text-sky-200">Aguardando Asaas</span> : null}
                    {account.approvalStatus === 'pending' ? <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">Aguardando aprovação</span> : null}
                  </p>
                  {account.approvalStatus === 'pending' && account.approval?.summary ? <p className="mt-1 text-xs text-amber-300">{account.approval.summary}</p> : null}
                  <p className="mt-1 text-xs text-sand-dark">
                    {account.type === 'RECEIVABLE' ? 'Conta a receber' : 'Conta a pagar'} •{account.member ? <MemberLink id={account.member.id} name={account.member.name} /> : (account.counterparty?.name ?? 'Sem vínculo')}
                  </p>
                </div>
                <div className="min-w-28 text-right">
                  <p className={`text-sm font-medium tabular-nums ${account.type === 'RECEIVABLE' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {account.type === 'RECEIVABLE' ? '+' : '−'}{brl(account.amount)}
                  </p>
                  <p className="mt-0.5 text-xs text-sand-dark">{formatDateOnly(account.dueDate)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {account.approvalStatus === 'pending' && account.approval?.canApprove ? (
                    <button onClick={() => void handleApprove(account.id)} className="text-xs px-1 py-1 text-emerald-300 transition hover:text-emerald-200">Aprovar</button>
                  ) : null}
                  {account.approvalStatus === 'pending' && account.approval?.canValve ? (
                    <button onClick={() => void handleApprove(account.id, true)} className="text-xs px-1 py-1 text-amber-300 transition hover:text-amber-200">Aprovar sozinho</button>
                  ) : null}
                  {account.type === 'PAYABLE' ? (
                    <span className="flex items-center gap-2">
                      {(account.proofs ?? []).map((pr) => (
                        <a key={pr.paymentId} href={`/api/payments/${pr.paymentId}/proof`} target="_blank" rel="noopener noreferrer" className="text-xs px-1 py-1 text-emerald-300 transition hover:text-emerald-200">{(account.proofs ?? []).length > 1 ? pr.label : 'Ver comprovante'}</a>
                      ))}
                      {account.hasReceipt ? (
                        <>
                          <a href={`/api/accounts/${account.id}/receipt`} target="_blank" rel="noopener noreferrer" className="text-xs px-1 py-1 text-emerald-300 transition hover:text-emerald-200">Ver comprovante</a>
                          <button onClick={() => void handleReceiptRemove(account.id)} className="text-xs px-1 py-1 text-sand-dark transition hover:text-sand">Tirar</button>
                        </>
                      ) : null}
                      <label className="cursor-pointer text-xs px-1 py-1 text-gold transition hover:text-gold-light">
                        {account.hasReceipt ? 'Trocar' : 'Anexar comprovante'}
                        <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void handleReceiptFile(account.id, f); }} />
                      </label>
                    </span>
                  ) : null}
                  <button onClick={() => startEdit(account)} className="text-xs px-1 py-1 text-gold transition hover:text-gold-light">Editar</button>
                  <button onClick={() => void handleDelete(account.id)} className="text-xs px-1 py-1 text-rose-300 transition hover:text-rose-200">Remover</button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>

        {newFilters && reportOpen ? (
          <AccountsReport
            rows={shownRows}
            filters={filters}
            details={describeFilters(filters, { people: personOptions, categories: chartAccounts.map((c) => ({ id: c.id, name: `${c.code} ${c.name}` })), banks: financialAccounts.map((b) => ({ id: b.id, name: b.name })) })}
            today={today}
            lodgeName={lodgeName}
            crestUrl={crestUrl}
            issuedBy={issuedBy}
          />
        ) : null}
      </div>
    </main>
  );
}
