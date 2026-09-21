"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, CollapsibleCard, inputClass, useConfirm } from '@/components/ui';
import { BRAZILIAN_BANKS } from '@/lib/banks';
import { brl } from '@/lib/currency';

interface ChartAccountItem { id: string; code: string; name: string; type: string; category?: string | null; }
interface CounterpartyItem {
  id: string; kind: string; name: string; legalName: string | null; document: string | null;
  isCompany: boolean; email: string | null; phone: string | null; city: string | null; state: string | null;
}
interface FinancialAccountItem {
  id: string; name: string; kind: string; bankName: string | null; isInvestment: boolean;
  agency: string | null; accountNumber: string | null; active: boolean; openingBalance: number;
}

const KIND_LABEL: Record<string, string> = { client: 'Cliente', supplier: 'Fornecedor', both: 'Cliente e fornecedor' };
const FA_KIND_LABEL: Record<string, string> = { bank: 'Banco', cash: 'Caixa' };

export default function CadastrosFinanceirosClient({ chartAccounts, counterparties, financialAccounts }: { chartAccounts: ChartAccountItem[]; counterparties: CounterpartyItem[]; financialAccounts: FinancialAccountItem[] }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [linking, setLinking] = useState(false);

  function notify(kind: 'ok' | 'error', text: string) {
    setMessage({ kind, text });
  }

  // --- Plano de contas -------------------------------------------------
  const [editingChart, setEditingChart] = useState<string | null>(null);
  const [chartEditForm, setChartEditForm] = useState({ code: '', name: '' });
  const [chartForm, setChartForm] = useState({ code: '', name: '', type: 'REVENUE' });
  const [showChartForm, setShowChartForm] = useState(false);

  async function createChartAccount(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch('/api/chart-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chartForm),
    });
    if (res.ok) {
      notify('ok', 'Conta criada com sucesso.');
      setChartForm({ code: '', name: '', type: 'REVENUE' });
      setShowChartForm(false);
      router.refresh();
    } else {
      const data = await res.json();
      notify('error', data.error ?? 'Erro ao criar conta.');
    }
  }

  function startEditChart(c: ChartAccountItem) {
    setEditingChart(c.id);
    setChartEditForm({ code: c.code, name: c.name });
  }

  async function saveChart(id: string) {
    const res = await fetch(`/api/chart-accounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chartEditForm) });
    setEditingChart(null);
    if (res.ok) {
      notify('ok', 'Conta atualizada.');
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      notify('error', d.error ?? 'Erro ao atualizar conta.');
    }
  }

  async function removeChartAccount(id: string) {
    if (!(await askConfirm({ title: 'Remover conta', message: 'Remover esta conta do plano de contas?', confirmLabel: 'Remover', intent: 'danger' }))) return;
    const res = await fetch(`/api/chart-accounts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      notify('ok', 'Conta removida.');
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      notify('error', d.error ?? 'Erro ao remover conta.');
    }
  }

  async function syncChart() {
    if (!(await askConfirm({ title: 'Atualizar plano de contas', message: 'Adiciona as contas que faltam e remove as contas padrão antigas que não estão em uso. Continuar?', confirmLabel: 'Atualizar' }))) return;
    setLinking(true);
    setMessage(null);
    const res = await fetch('/api/chart-accounts/sync', { method: 'POST' });
    const data = await res.json();
    setLinking(false);
    if (res.ok) {
      const s = data.stats ?? {};
      notify('ok', `Plano de contas atualizado: ${s.added ?? 0} adicionadas, ${s.removed ?? 0} antigas removidas, ${s.kept ?? 0} mantidas.`);
      router.refresh();
    } else {
      notify('error', data.error ?? 'Erro ao atualizar o plano de contas.');
    }
  }

  async function backfillChart() {
    if (!(await askConfirm({ title: 'Vincular contas ao plano', message: 'Tenta vincular automaticamente, pelo título, todas as contas a pagar/receber ainda sem categoria do plano de contas. Continuar?', confirmLabel: 'Vincular' }))) return;
    setLinking(true);
    setMessage(null);
    const res = await fetch('/api/accounts/backfill-chart', { method: 'POST' });
    const data = await res.json();
    setLinking(false);
    if (res.ok) {
      const s = data.stats ?? {};
      notify('ok', `Vínculo ao plano de contas: ${s.matched ?? 0} contas vinculadas, ${s.skipped ?? 0} sem correspondência (de ${s.processed ?? 0} sem vínculo).`);
    } else {
      notify('error', data.error ?? 'Erro ao vincular contas ao plano.');
    }
  }

  // --- Clientes e fornecedores ------------------------------------------
  const EMPTY_CP_FORM = { kind: 'supplier', name: '', document: '', phone: '', city: '', state: '' };
  const [cpForm, setCpForm] = useState(EMPTY_CP_FORM);
  const [showCpForm, setShowCpForm] = useState(false);
  const [editingCp, setEditingCp] = useState<string | null>(null);
  const [cpEditForm, setCpEditForm] = useState({ name: '', kind: 'supplier', document: '', phone: '' });
  const [cpFilter, setCpFilter] = useState<'all' | 'client' | 'supplier'>('all');
  const [cpSaving, setCpSaving] = useState(false);

  async function createCounterparty(event: React.FormEvent) {
    event.preventDefault();
    setCpSaving(true);
    const res = await fetch('/api/counterparties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cpForm, document: cpForm.document || null }),
    });
    const data = await res.json();
    setCpSaving(false);
    if (res.ok) {
      notify('ok', 'Contraparte criada com sucesso.');
      setCpForm(EMPTY_CP_FORM);
      setShowCpForm(false);
      router.refresh();
    } else {
      notify('error', data.error ?? 'Erro ao criar contraparte.');
    }
  }

  function startEditCp(c: CounterpartyItem) {
    setEditingCp(c.id);
    setCpEditForm({ name: c.name, kind: c.kind, document: c.document ?? '', phone: c.phone ?? '' });
  }

  async function saveCp(id: string) {
    const res = await fetch(`/api/counterparties/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cpEditForm, document: cpEditForm.document || null, phone: cpEditForm.phone || null }),
    });
    setEditingCp(null);
    if (res.ok) {
      notify('ok', 'Contraparte atualizada.');
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      notify('error', d.error ?? 'Erro ao atualizar contraparte.');
    }
  }

  async function removeCounterparty(id: string) {
    if (!(await askConfirm({ title: 'Remover contraparte', message: 'Remover este cliente/fornecedor? Contas já lançadas mantêm o nome, só perdem o vínculo com o cadastro.', confirmLabel: 'Remover', intent: 'danger' }))) return;
    const res = await fetch(`/api/counterparties/${id}`, { method: 'DELETE' });
    if (res.ok) {
      notify('ok', 'Contraparte removida.');
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      notify('error', d.error ?? 'Erro ao remover contraparte.');
    }
  }

  // --- Contas bancárias e Caixa ------------------------------------------
  const EMPTY_FA_FORM = { kind: 'bank', name: '', bankName: BRAZILIAN_BANKS[0], isInvestment: false, agency: '', accountNumber: '', openingBalance: '' };
  const [faForm, setFaForm] = useState(EMPTY_FA_FORM);
  const [showFaForm, setShowFaForm] = useState(false);
  const [editingFa, setEditingFa] = useState<string | null>(null);
  const [faEditForm, setFaEditForm] = useState({ name: '', agency: '', accountNumber: '', openingBalance: '' });
  const [faFilter, setFaFilter] = useState<'all' | 'bank' | 'cash'>('all');
  const [faSaving, setFaSaving] = useState(false);

  async function createFinancialAccount(event: React.FormEvent) {
    event.preventDefault();
    setFaSaving(true);
    const name = faForm.kind === 'cash' ? (faForm.name || 'Caixa da Loja') : (faForm.name || faForm.bankName);
    const res = await fetch('/api/financial-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...faForm, name }),
    });
    const data = await res.json();
    setFaSaving(false);
    if (res.ok) {
      notify('ok', 'Conta financeira criada com sucesso.');
      setFaForm(EMPTY_FA_FORM);
      setShowFaForm(false);
      router.refresh();
    } else {
      notify('error', data.error ?? 'Erro ao criar conta financeira.');
    }
  }

  function startEditFa(f: FinancialAccountItem) {
    setEditingFa(f.id);
    setFaEditForm({ name: f.name, agency: f.agency ?? '', accountNumber: f.accountNumber ?? '', openingBalance: String(f.openingBalance ?? 0) });
  }

  async function saveFa(id: string) {
    const res = await fetch(`/api/financial-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...faEditForm, agency: faEditForm.agency || null, accountNumber: faEditForm.accountNumber || null }),
    });
    setEditingFa(null);
    if (res.ok) {
      notify('ok', 'Conta financeira atualizada.');
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      notify('error', d.error ?? 'Erro ao atualizar conta financeira.');
    }
  }

  async function toggleFinancialAccountActive(item: FinancialAccountItem) {
    const res = await fetch(`/api/financial-accounts/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !item.active }) });
    if (res.ok) {
      notify('ok', 'Conta financeira atualizada.');
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      notify('error', d.error ?? 'Erro ao atualizar conta financeira.');
    }
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Cadastros financeiros</h1>
          <p className="mt-1 text-sm text-sand-dark">Plano de contas, clientes/fornecedores e as contas bancárias/Caixa da loja.</p>
        </div>

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

        <CollapsibleCard title="Plano de contas" count={chartAccounts.length} defaultOpen={false}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-sand-dark">Categorias de receita e despesa típicas de uma loja maçônica.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowChartForm(true)}>+ Nova conta</Button>
              <Button variant="ghost" size="sm" onClick={syncChart} disabled={linking}>{linking ? '…' : 'Sincronizar padrão'}</Button>
              <Button variant="ghost" size="sm" onClick={backfillChart} disabled={linking || chartAccounts.length === 0}>Vincular contas</Button>
            </div>
          </div>

          {showChartForm ? (
            <form onSubmit={createChartAccount} className="mb-4 grid gap-3 rounded-lg border border-white/6 bg-sigma-blue-deep/50 p-4 sm:grid-cols-3">
              <input value={chartForm.code} onChange={(e) => setChartForm({ ...chartForm, code: e.target.value })} className={inputClass} placeholder="Código (ex: 1.1.01)" required />
              <input value={chartForm.name} onChange={(e) => setChartForm({ ...chartForm, name: e.target.value })} className={inputClass} placeholder="Nome da conta" required />
              <select value={chartForm.type} onChange={(e) => setChartForm({ ...chartForm, type: e.target.value })} className={inputClass} aria-label="Tipo da conta">
                <option value="REVENUE">Receita</option>
                <option value="EXPENSE">Despesa</option>
              </select>
              <div className="flex gap-2 sm:col-span-3">
                <Button type="submit">Criar</Button>
                <Button type="button" variant="ghost" onClick={() => setShowChartForm(false)}>Cancelar</Button>
              </div>
            </form>
          ) : null}

          {chartAccounts.length === 0 ? (
            <p className="mt-4 text-sm text-sand-dark">Nenhuma conta no plano.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {(['REVENUE', 'EXPENSE'] as const).map((type) => (
                <div key={type}>
                  <h3 className={`text-sm font-semibold uppercase tracking-wide ${type === 'REVENUE' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {type === 'REVENUE' ? 'Receitas' : 'Despesas'}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {chartAccounts.filter((c) => c.type === type).map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-2 text-sm text-sand">
                        {editingChart === c.id ? (
                          <div className="flex w-full flex-wrap gap-2">
                            <input value={chartEditForm.code} onChange={(e) => setChartEditForm({ ...chartEditForm, code: e.target.value })} aria-label="Código" className="w-20 rounded border border-white/8 bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50" />
                            <input value={chartEditForm.name} onChange={(e) => setChartEditForm({ ...chartEditForm, name: e.target.value })} aria-label="Nome" className="flex-1 rounded border border-white/8 bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50" />
                            <button onClick={() => saveChart(c.id)} className="text-xs text-gold">Salvar</button>
                            <button onClick={() => setEditingChart(null)} className="text-xs text-sand-dark">Cancelar</button>
                          </div>
                        ) : (
                          <>
                            <span><span className="text-sand-dark">{c.code}</span> · {c.name}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              {c.category ? <span className="text-xs text-sand-dark">{c.category}</span> : null}
                              <button onClick={() => startEditChart(c)} className="text-xs text-sand-dark hover:text-gold">Editar</button>
                              <button onClick={() => removeChartAccount(c.id)} className="text-xs text-rose-300/70 hover:text-rose-300">Remover</button>
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CollapsibleCard>

        <CollapsibleCard title="Clientes e fornecedores" count={counterparties.length} defaultOpen={false}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-sand-dark">Contrapartes de contas a pagar/receber que não são membros da loja.</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={cpFilter} onChange={(e) => setCpFilter(e.target.value as typeof cpFilter)} aria-label="Filtrar por tipo" className={`${inputClass} w-auto py-1.5 text-xs`}>
                <option value="all">Todos</option>
                <option value="client">Clientes</option>
                <option value="supplier">Fornecedores</option>
              </select>
              <Button variant="ghost" size="sm" onClick={() => setShowCpForm(true)}>+ Novo cadastro</Button>
            </div>
          </div>

          {showCpForm ? (
            <form onSubmit={createCounterparty} className="mb-4 grid gap-3 rounded-lg border border-white/6 bg-sigma-blue-deep/50 p-4 sm:grid-cols-2">
              <input value={cpForm.name} onChange={(e) => setCpForm({ ...cpForm, name: e.target.value })} className={inputClass} placeholder="Nome" required />
              <select value={cpForm.kind} onChange={(e) => setCpForm({ ...cpForm, kind: e.target.value })} className={inputClass} aria-label="Tipo de contraparte">
                <option value="supplier">Fornecedor</option>
                <option value="client">Cliente</option>
                <option value="both">Cliente e fornecedor</option>
              </select>
              <input value={cpForm.document} onChange={(e) => setCpForm({ ...cpForm, document: e.target.value })} className={inputClass} placeholder="CPF/CNPJ (opcional)" />
              <input value={cpForm.phone} onChange={(e) => setCpForm({ ...cpForm, phone: e.target.value })} className={inputClass} placeholder="Telefone (opcional)" />
              <input value={cpForm.city} onChange={(e) => setCpForm({ ...cpForm, city: e.target.value })} className={inputClass} placeholder="Cidade (opcional)" />
              <div className="flex gap-2">
                <Button type="submit" disabled={cpSaving}>{cpSaving ? '…' : 'Criar'}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowCpForm(false)}>Cancelar</Button>
              </div>
            </form>
          ) : null}

          {counterparties.filter((c) => cpFilter === 'all' || c.kind === cpFilter || c.kind === 'both').length === 0 ? (
            <p className="mt-4 text-sm text-sand-dark">Nenhum cadastro ainda.</p>
          ) : (
            <ul className="space-y-2">
              {counterparties
                .filter((c) => cpFilter === 'all' || c.kind === cpFilter || c.kind === 'both')
                .map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-2.5 text-sm text-sand">
                    {editingCp === c.id ? (
                      <div className="flex w-full flex-wrap gap-2">
                        <input value={cpEditForm.name} onChange={(e) => setCpEditForm({ ...cpEditForm, name: e.target.value })} aria-label="Nome" className="min-w-[10rem] flex-1 rounded border border-white/8 bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50" />
                        <select value={cpEditForm.kind} onChange={(e) => setCpEditForm({ ...cpEditForm, kind: e.target.value })} aria-label="Tipo" className="rounded border border-white/8 bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50">
                          <option value="supplier">Fornecedor</option>
                          <option value="client">Cliente</option>
                          <option value="both">Cliente e fornecedor</option>
                        </select>
                        <input value={cpEditForm.document} onChange={(e) => setCpEditForm({ ...cpEditForm, document: e.target.value })} aria-label="CPF/CNPJ" placeholder="CPF/CNPJ" className="w-32 rounded border border-white/8 bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50" />
                        <input value={cpEditForm.phone} onChange={(e) => setCpEditForm({ ...cpEditForm, phone: e.target.value })} aria-label="Telefone" placeholder="Telefone" className="w-32 rounded border border-white/8 bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50" />
                        <button onClick={() => saveCp(c.id)} className="text-xs text-gold">Salvar</button>
                        <button onClick={() => setEditingCp(null)} className="text-xs text-sand-dark">Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="truncate">{c.name}</span>
                          {c.document ? <span className="ml-2 text-xs text-sand-dark">{c.document}</span> : null}
                          {c.phone ? <span className="ml-2 text-xs text-sand-dark">{c.phone}</span> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${c.kind === 'client' ? 'bg-emerald-500/10 text-emerald-300' : c.kind === 'supplier' ? 'bg-rose-500/10 text-rose-300' : 'bg-gold/10 text-gold'}`}>
                            {KIND_LABEL[c.kind] ?? c.kind}
                          </span>
                          <button onClick={() => startEditCp(c)} className="text-xs text-sand-dark hover:text-gold">Editar</button>
                          <button onClick={() => removeCounterparty(c.id)} className="text-xs text-rose-300/70 hover:text-rose-300">Remover</button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </CollapsibleCard>

        <CollapsibleCard title="Contas bancárias e Caixa" count={financialAccounts.length} defaultOpen={false}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-sand-dark">Bancos, contas de investimento e o Caixa físico da loja — vincule pagamentos/recebimentos a cada um.</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={faFilter} onChange={(e) => setFaFilter(e.target.value as typeof faFilter)} aria-label="Filtrar por tipo" className={`${inputClass} w-auto py-1.5 text-xs`}>
                <option value="all">Todas</option>
                <option value="bank">Bancos</option>
                <option value="cash">Caixa</option>
              </select>
              <Button variant="ghost" size="sm" onClick={() => setShowFaForm(true)}>+ Nova conta</Button>
            </div>
          </div>

          {showFaForm ? (
            <form onSubmit={createFinancialAccount} className="mb-4 grid gap-3 rounded-lg border border-white/6 bg-sigma-blue-deep/50 p-4 sm:grid-cols-2">
              <select value={faForm.kind} onChange={(e) => setFaForm({ ...faForm, kind: e.target.value })} className={inputClass} aria-label="Tipo de conta">
                <option value="bank">Banco</option>
                <option value="cash">Caixa</option>
              </select>
              {faForm.kind === 'bank' ? (
                <>
                  <select value={faForm.bankName} onChange={(e) => setFaForm({ ...faForm, bankName: e.target.value })} className={inputClass} aria-label="Banco">
                    {BRAZILIAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <input value={faForm.name} onChange={(e) => setFaForm({ ...faForm, name: e.target.value })} className={inputClass} placeholder="Rótulo (ex: Santander CC — opcional)" />
                  <input value={faForm.agency} onChange={(e) => setFaForm({ ...faForm, agency: e.target.value })} className={inputClass} placeholder="Agência (opcional)" />
                  <input value={faForm.accountNumber} onChange={(e) => setFaForm({ ...faForm, accountNumber: e.target.value })} className={inputClass} placeholder="Conta (opcional)" />
                  <label className="flex items-center gap-2 text-sm text-sand-dark sm:col-span-2">
                    <input type="checkbox" checked={faForm.isInvestment} onChange={(e) => setFaForm({ ...faForm, isInvestment: e.target.checked })} />
                    Conta de investimento
                  </label>
                </>
              ) : (
                <input value={faForm.name} onChange={(e) => setFaForm({ ...faForm, name: e.target.value })} className={inputClass} placeholder="Nome (ex: Caixa da Loja)" />
              )}
              <label className="block text-sm text-sand-dark sm:col-span-2">
                Saldo inicial (o que já existia nessa conta antes de começar a usar o sistema)
                <input type="number" step="0.01" value={faForm.openingBalance} onChange={(e) => setFaForm({ ...faForm, openingBalance: e.target.value })} className={`mt-1 ${inputClass}`} placeholder="0,00" />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={faSaving}>{faSaving ? '…' : 'Criar'}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowFaForm(false)}>Cancelar</Button>
              </div>
            </form>
          ) : null}

          {financialAccounts.filter((f) => faFilter === 'all' || f.kind === faFilter).length === 0 ? (
            <p className="mt-4 text-sm text-sand-dark">Nenhuma conta cadastrada.</p>
          ) : (
            <ul className="space-y-2">
              {financialAccounts
                .filter((f) => faFilter === 'all' || f.kind === faFilter)
                .map((f) => (
                  <li key={f.id} className={`flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-2.5 text-sm text-sand ${!f.active ? 'opacity-50' : ''}`}>
                    {editingFa === f.id ? (
                      <div className="flex w-full flex-wrap gap-2">
                        <input value={faEditForm.name} onChange={(e) => setFaEditForm({ ...faEditForm, name: e.target.value })} aria-label="Nome" className="min-w-[10rem] flex-1 rounded border border-white/8 bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50" />
                        <input value={faEditForm.agency} onChange={(e) => setFaEditForm({ ...faEditForm, agency: e.target.value })} aria-label="Agência" placeholder="Agência" className="w-24 rounded border border-white/8 bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50" />
                        <input value={faEditForm.accountNumber} onChange={(e) => setFaEditForm({ ...faEditForm, accountNumber: e.target.value })} aria-label="Conta" placeholder="Conta" className="w-28 rounded border border-white/8 bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50" />
                        <input type="number" step="0.01" value={faEditForm.openingBalance} onChange={(e) => setFaEditForm({ ...faEditForm, openingBalance: e.target.value })} aria-label="Saldo inicial" placeholder="Saldo inicial" className="w-32 rounded border border-white/8 bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50" />
                        <button onClick={() => saveFa(f.id)} className="text-xs text-gold">Salvar</button>
                        <button onClick={() => setEditingFa(null)} className="text-xs text-sand-dark">Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="truncate">{f.name}</span>
                          {f.bankName ? <span className="ml-2 text-xs text-sand-dark">{f.bankName}</span> : null}
                          {f.agency || f.accountNumber ? <span className="ml-2 text-xs text-sand-dark">Ag. {f.agency ?? '—'} / Cc {f.accountNumber ?? '—'}</span> : null}
                          {f.openingBalance ? <span className="ml-2 text-xs text-sand-dark">Saldo inicial: {brl(f.openingBalance)}</span> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {f.isInvestment ? <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[0.65rem] font-medium text-gold">Investimento</span> : null}
                          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${f.kind === 'bank' ? 'bg-sky-500/10 text-sky-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                            {FA_KIND_LABEL[f.kind] ?? f.kind}
                          </span>
                          <button onClick={() => startEditFa(f)} className="text-xs text-sand-dark hover:text-gold">Editar</button>
                          <button onClick={() => toggleFinancialAccountActive(f)} className="text-xs text-sand-dark hover:text-gold">{f.active ? 'Desativar' : 'Ativar'}</button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </CollapsibleCard>
      </div>
    </main>
  );
}
