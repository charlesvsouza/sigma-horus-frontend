'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, inputClass, Alert, useConfirm } from '@/components/ui';

interface ChartAccountOption { id: string; code: string; name: string; }
interface AssetItem {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  acquisitionDate?: string | null;
  acquisitionValue: number;
  currentValue?: number | null;
  status: string;
  notes?: string | null;
  chartAccount?: ChartAccountOption | null;
}

const STATUS_LABEL: Record<string, string> = { active: 'Em uso', disposed: 'Baixado/alienado', lost: 'Perdido/sinistrado' };
const CATEGORIES = ['Móveis', 'Insígnias', 'Equipamentos', 'Imóveis', 'Outros'];
const INPUT_CLASS = inputClass;
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PatrimonioClient({ assets, chartAccounts }: { assets: AssetItem[]; chartAccounts: ChartAccountOption[] }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyForm = { name: '', description: '', category: '', acquisitionDate: '', acquisitionValue: '', currentValue: '', status: 'active', chartAccountId: '', notes: '' };
  const [form, setForm] = useState(emptyForm);

  function startEdit(asset: AssetItem) {
    setEditingId(asset.id);
    setForm({
      name: asset.name,
      description: asset.description ?? '',
      category: asset.category ?? '',
      acquisitionDate: asset.acquisitionDate ? asset.acquisitionDate.slice(0, 10) : '',
      acquisitionValue: String(asset.acquisitionValue),
      currentValue: asset.currentValue != null ? String(asset.currentValue) : '',
      status: asset.status,
      chartAccountId: asset.chartAccount?.id ?? '',
      notes: asset.notes ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(editingId ? `/api/assets/${editingId}` : '/api/assets', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage(editingId ? 'Bem atualizado.' : 'Bem cadastrado.');
      cancelEdit();
      router.refresh();
    } else {
      setMessage(data.error ?? 'Erro ao salvar.');
    }
  }

  async function handleDelete(id: string) {
    if (!(await askConfirm({ title: 'Remover bem', message: 'Remove este item do inventário.', confirmLabel: 'Remover', intent: 'danger' }))) return;
    const response = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
    if (response.ok) router.refresh();
  }

  const q = search.trim().toLowerCase();
  const filtered = q ? assets.filter((a) => a.name.toLowerCase().includes(q) || a.category?.toLowerCase().includes(q)) : assets;
  const totalAcquisition = assets.reduce((s, a) => s + a.acquisitionValue, 0);
  const totalCurrent = assets.reduce((s, a) => s + (a.currentValue ?? a.acquisitionValue), 0);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Patrimônio</h1>
          <p className="mt-1 text-sm text-sand-dark">Inventário de bens da loja — móveis, insígnias, equipamentos. Cadastro simples, sem cálculo automático de depreciação.</p>
        </div>

        {message ? <Alert intent="warn">{message}</Alert> : null}

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Total investido (aquisição)</p>
            <p className="mt-3 text-2xl font-semibold text-sand-light">{brl(totalAcquisition)}</p>
          </div>
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Valor atual estimado</p>
            <p className="mt-3 text-2xl font-semibold text-gold">{brl(totalCurrent)}</p>
          </div>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-sand-light">{editingId ? 'Editar bem' : 'Novo bem'}</h2>
            {editingId ? <button type="button" onClick={cancelEdit} className="text-xs text-sand-dark hover:text-sand">Cancelar edição</button> : null}
          </div>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT_CLASS} placeholder="Nome do bem" required />
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={INPUT_CLASS} placeholder="Categoria" list="asset-categories" />
            <datalist id="asset-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            <label className="block text-xs text-sand-dark">Data de aquisição
              <input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} className={`mt-1.5 ${INPUT_CLASS}`} />
            </label>
            <input type="number" step="0.01" min="0" value={form.acquisitionValue} onChange={(e) => setForm({ ...form, acquisitionValue: e.target.value })} className={INPUT_CLASS} placeholder="Valor de aquisição" required />
            <input type="number" step="0.01" min="0" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} className={INPUT_CLASS} placeholder="Valor atual estimado (opcional)" />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={INPUT_CLASS}>
              <option value="active">Em uso</option>
              <option value="disposed">Baixado/alienado</option>
              <option value="lost">Perdido/sinistrado</option>
            </select>
            <select value={form.chartAccountId} onChange={(e) => setForm({ ...form, chartAccountId: e.target.value })} className={`${INPUT_CLASS} md:col-span-2`}>
              <option value="">Vincular ao plano de contas (opcional — categoria Investimentos)</option>
              {chartAccounts.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${INPUT_CLASS} md:col-span-2`} placeholder="Descrição" rows={2} />
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${INPUT_CLASS} md:col-span-2`} placeholder="Observações" rows={2} />
            <Button type="submit" className="md:col-span-2">{editingId ? 'Salvar alterações' : 'Cadastrar bem'}</Button>
          </form>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-sand-light">Bens cadastrados</h2>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou categoria…" className={`${INPUT_CLASS} max-w-xs`} />
          </div>
          <div className="mt-5 space-y-3">
            {assets.length === 0 ? (
              <EmptyState title="Nenhum bem cadastrado" description="Registre o primeiro item do patrimônio da loja." />
            ) : filtered.length === 0 ? (
              <p className="text-sm text-sand-dark">Nenhum bem encontrado para &quot;{search}&quot;.</p>
            ) : filtered.map((asset) => (
              <div key={asset.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/[8%]">
                <div>
                  <p className="text-sm font-medium text-sand-light">
                    {asset.name}
                    {asset.category ? <span className="ml-2 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">{asset.category}</span> : null}
                  </p>
                  <p className="mt-1 text-xs text-sand-dark">
                    {STATUS_LABEL[asset.status] ?? asset.status}
                    {asset.acquisitionDate ? ` • adquirido em ${new Date(asset.acquisitionDate).toLocaleDateString('pt-BR')}` : ''}
                    {asset.chartAccount ? ` • ${asset.chartAccount.code} — ${asset.chartAccount.name}` : ''}
                  </p>
                </div>
                <div className="text-right text-xs text-sand-dark">
                  <p className="tabular-nums">{brl(asset.currentValue ?? asset.acquisitionValue)}</p>
                  {asset.currentValue != null && asset.currentValue !== asset.acquisitionValue ? (
                    <p className="mt-0.5 text-[11px]">Aquisição: {brl(asset.acquisitionValue)}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => startEdit(asset)} className="text-xs text-gold/70 transition hover:text-gold">Editar</button>
                  <button onClick={() => void handleDelete(asset.id)} className="text-xs text-rose-300/60 transition hover:text-rose-300">Remover</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
