"use client";

import { useState } from 'react';
import { Alert, useConfirm } from '@/components/ui';
import { useRouter } from 'next/navigation';

interface Item { id: string; name: string; order: number; }
interface ChartAccountItem { id: string; code: string; name: string; type: string; category?: string | null; }

function InlineEdit({ value, onSave, onCancel }: { value: string; onSave: (v: string) => Promise<void>; onCancel: () => void }) {
  const [edit, setEdit] = useState(value);
  const [saving, setSaving] = useState(false);
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSave(edit); setSaving(false); }} className="flex gap-2 flex-1">
      <input
        value={edit} onChange={(e) => setEdit(e.target.value)}
        className="flex-1 rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-1.5 text-sm text-sand-light outline-none focus:border-gold/50"
        autoFocus
      />
      <button type="submit" disabled={saving || !edit.trim()} className="text-xs text-gold hover:text-gold-light disabled:opacity-40">Salvar</button>
      <button type="button" onClick={onCancel} className="text-xs text-sand-dark hover:text-sand">Cancelar</button>
    </form>
  );
}

function CollapsibleCard({ title, count, defaultOpen, children }: { title: string; count: number; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen || count <= 10);
  return (
    <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <h2 className="text-base font-semibold text-sand-light">{title}</h2>
          <p className="mt-0.5 text-xs text-sand-dark">{count} registro{count !== 1 ? 's' : ''}</p>
        </div>
        <svg className={`h-4 w-4 shrink-0 text-sand-dark transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export default function CadastrosClient({ rites, powers, chartAccounts }: { rites: Item[]; powers: Item[]; chartAccounts: ChartAccountItem[] }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [riteName, setRiteName] = useState('');
  const [powerName, setPowerName] = useState('');
  const [editingRite, setEditingRite] = useState<string | null>(null);
  const [editingPower, setEditingPower] = useState<string | null>(null);
  const [editingChart, setEditingChart] = useState<string | null>(null);
  const [chartForm, setChartForm] = useState({ code: '', name: '', type: 'REVENUE' });
  const [showChartForm, setShowChartForm] = useState(false);
  const [message, setMessage] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [linking, setLinking] = useState(false);

  async function seedDefaults() {
    setSeeding(true);
    setMessage('');
    const res = await fetch('/api/lodges/seed-defaults', { method: 'POST' });
    const data = await res.json();
    setSeeding(false);
    if (res.ok) {
      const s = data.seeded ?? {};
      setMessage(`Dados padrão populados: ${s.rites ?? 0} ritos, ${s.powers ?? 0} potências, ${s.chartAccounts ?? 0} contas do plano.`);
      router.refresh();
    } else {
      setMessage(data.error ?? 'Erro ao popular dados padrão.');
    }
  }

  async function syncChart() {
    if (!(await askConfirm({ title: 'Atualizar plano de contas', message: 'Adiciona as contas que faltam e remove as contas padrão antigas que não estão em uso. Continuar?', confirmLabel: 'Atualizar' }))) return;
    setLinking(true);
    setMessage('');
    const res = await fetch('/api/chart-accounts/sync', { method: 'POST' });
    const data = await res.json();
    setLinking(false);
    if (res.ok) {
      const s = data.stats ?? {};
      setMessage(`Plano de contas atualizado: ${s.added ?? 0} adicionadas, ${s.removed ?? 0} antigas removidas, ${s.kept ?? 0} mantidas.`);
      router.refresh();
    } else {
      setMessage(data.error ?? 'Erro ao atualizar o plano de contas.');
    }
  }

  async function backfillChart() {
    setLinking(true);
    setMessage('');
    const res = await fetch('/api/accounts/backfill-chart', { method: 'POST' });
    const data = await res.json();
    setLinking(false);
    if (res.ok) {
      const s = data.stats ?? {};
      setMessage(`Vínculo ao plano de contas: ${s.matched ?? 0} contas vinculadas, ${s.skipped ?? 0} sem correspondência (de ${s.processed ?? 0} sem vínculo).`);
    } else {
      setMessage(data.error ?? 'Erro ao vincular contas ao plano.');
    }
  }

  async function createRite(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/rites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: riteName, order: 1 }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Rito criado com sucesso.');
      setRiteName('');
      router.refresh();
    } else {
      setMessage(data.error ?? 'Erro ao criar rito.');
    }
  }

  async function createPower(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/powers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: powerName, order: 1 }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Potência criada com sucesso.');
      setPowerName('');
      router.refresh();
    } else {
      setMessage(data.error ?? 'Erro ao criar potência.');
    }
  }

  async function renameRite(id: string, name: string) {
    await fetch(`/api/rites/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    setEditingRite(null);
    router.refresh();
  }

  async function renamePower(id: string, name: string) {
    await fetch(`/api/powers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    setEditingPower(null);
    router.refresh();
  }

  async function renameChart(id: string, data: { code?: string; name?: string }) {
    await fetch(`/api/chart-accounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setEditingChart(null);
    router.refresh();
  }

  async function removeRite(id: string) {
    if (!(await askConfirm({ title: 'Remover rito', message: 'Remover este rito?', confirmLabel: 'Remover', intent: 'danger' }))) return;
    await fetch(`/api/rites/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  async function removePower(id: string) {
    if (!(await askConfirm({ title: 'Remover potência', message: 'Remover esta potência?', confirmLabel: 'Remover', intent: 'danger' }))) return;
    await fetch(`/api/powers/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  async function removeChartAccount(id: string) {
    if (!(await askConfirm({ title: 'Remover conta', message: 'Remover esta conta do plano de contas?', confirmLabel: 'Remover', intent: 'danger' }))) return;
    await fetch(`/api/chart-accounts/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  async function createChartAccount(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch('/api/chart-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chartForm),
    });
    if (res.ok) {
      setMessage('Conta criada com sucesso.');
      setChartForm({ code: '', name: '', type: 'REVENUE' });
      setShowChartForm(false);
      router.refresh();
    } else {
      const data = await res.json();
      setMessage(data.error ?? 'Erro ao criar conta.');
    }
  }

  const INPUT = "flex-1 rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20";
  const ADD_BTN = "rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark";

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Cadastros mestre</h1>
            <p className="mt-1 text-sm text-sand-dark">Configure os ritos, potências e o plano de contas da sua loja.</p>
          </div>
          <button
            onClick={seedDefaults}
            disabled={seeding}
            title="Preenche ritos, potências e plano de contas com os dados padrão da Maçonaria brasileira (não duplica)"
            className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-all duration-200 ease-out hover:border-gold/60 hover:text-gold disabled:opacity-50"
          >
            {seeding ? 'Populando…' : 'Popular dados padrão (Brasil)'}
          </button>
        </div>

        {message ? <Alert intent="warn">{message}</Alert> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <CollapsibleCard title="Ritos" count={rites.length} defaultOpen={rites.length <= 10}>
            <form onSubmit={createRite} className="flex gap-3">
              <input value={riteName} onChange={(event) => setRiteName(event.target.value)} className={INPUT} placeholder="Nome do rito" />
              <button type="submit" className={ADD_BTN}>Adicionar</button>
            </form>
            {rites.length === 0 ? (
              <p className="mt-4 text-sm text-sand-dark">Nenhum rito cadastrado.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {rites.map((rite) => (
                  <li key={rite.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-2.5 text-sm text-sand-light hover:border-white/[8%]">
                    {editingRite === rite.id ? (
                      <InlineEdit value={rite.name} onSave={(v) => renameRite(rite.id, v)} onCancel={() => setEditingRite(null)} />
                    ) : (
                      <>
                        <span className="flex-1">{rite.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setEditingRite(rite.id)} className="text-xs text-sand-dark hover:text-gold">Editar</button>
                          <button onClick={() => removeRite(rite.id)} className="text-xs text-rose-300/70 hover:text-rose-300">Remover</button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleCard>

          <CollapsibleCard title="Potências" count={powers.length} defaultOpen={powers.length <= 10}>
            <form onSubmit={createPower} className="flex gap-3">
              <input value={powerName} onChange={(event) => setPowerName(event.target.value)} className={INPUT} placeholder="Nome da potência (com sigla do estado)" />
              <button type="submit" className={ADD_BTN}>Adicionar</button>
            </form>
            {powers.length === 0 ? (
              <p className="mt-4 text-sm text-sand-dark">Nenhuma potência cadastrada.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {powers.map((power) => (
                  <li key={power.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-2.5 text-sm text-sand-light hover:border-white/[8%]">
                    {editingPower === power.id ? (
                      <InlineEdit value={power.name} onSave={(v) => renamePower(power.id, v)} onCancel={() => setEditingPower(null)} />
                    ) : (
                      <>
                        <span className="flex-1">{power.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setEditingPower(power.id)} className="text-xs text-sand-dark hover:text-gold">Editar</button>
                          <button onClick={() => removePower(power.id)} className="text-xs text-rose-300/70 hover:text-rose-300">Remover</button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleCard>
        </div>

        <CollapsibleCard title="Plano de contas" count={chartAccounts.length} defaultOpen={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm text-sand-dark">Categorias de receita e despesa típicas de uma loja maçônica.</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowChartForm(true)}
                className="rounded-full border border-gold/40 px-4 py-1.5 text-xs font-medium text-gold/80 hover:border-gold/60 hover:text-gold"
              >
                + Nova conta
              </button>
              <button
                onClick={syncChart}
                disabled={linking}
                className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-sand-dark hover:text-sand-light disabled:opacity-40"
              >
                {linking ? '…' : 'Sincronizar padrão'}
              </button>
              <button
                onClick={backfillChart}
                disabled={linking || chartAccounts.length === 0}
                className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-sand-dark hover:text-sand-light disabled:opacity-40"
              >
                Vincular contas
              </button>
            </div>
          </div>

          {showChartForm ? (
            <form onSubmit={createChartAccount} className="mb-4 flex flex-wrap gap-3 rounded-lg border border-white/[6%] bg-sigma-blue-deep/50 p-4">
              <input value={chartForm.code} onChange={(e) => setChartForm({ ...chartForm, code: e.target.value })} className={INPUT} placeholder="Código (ex: 1.1.01)" required />
              <input value={chartForm.name} onChange={(e) => setChartForm({ ...chartForm, name: e.target.value })} className={INPUT} placeholder="Nome da conta" required />
              <select value={chartForm.type} onChange={(e) => setChartForm({ ...chartForm, type: e.target.value })} className={INPUT}>
                <option value="REVENUE">Receita</option>
                <option value="EXPENSE">Despesa</option>
              </select>
              <button type="submit" className={ADD_BTN}>Criar</button>
              <button type="button" onClick={() => setShowChartForm(false)} className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-sand-dark hover:text-sand">Cancelar</button>
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
                      <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-2 text-sm text-sand">
                        {editingChart === c.id ? (
                          <div className="flex w-full flex-wrap gap-2">
                            <input defaultValue={c.code} id={`chart-code-${c.id}`} className="w-20 rounded border border-white/[8%] bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50" />
                            <input defaultValue={c.name} id={`chart-name-${c.id}`} className="flex-1 rounded border border-white/[8%] bg-sigma-blue-deep/60 px-2 py-1 text-xs text-sand-light outline-none focus:border-gold/50" />
                            <button onClick={() => renameChart(c.id, { code: (document.getElementById(`chart-code-${c.id}`) as HTMLInputElement).value, name: (document.getElementById(`chart-name-${c.id}`) as HTMLInputElement).value })} className="text-xs text-gold">Salvar</button>
                            <button onClick={() => setEditingChart(null)} className="text-xs text-sand-dark">Cancelar</button>
                          </div>
                        ) : (
                          <>
                            <span><span className="text-sand-dark">{c.code}</span> · {c.name}</span>
                            <span className="flex items-center gap-2 shrink-0">
                              {c.category ? <span className="text-xs text-sand-dark">{c.category}</span> : null}
                              <button onClick={() => setEditingChart(c.id)} className="text-xs text-sand-dark hover:text-gold">Editar</button>
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
      </div>
    </main>
  );
}
