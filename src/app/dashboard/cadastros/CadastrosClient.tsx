"use client";

import { useState } from 'react';
import { Alert } from '@/components/ui';
import { useRouter } from 'next/navigation';

interface Item { id: string; name: string; order: number; }
interface ChartAccountItem { id: string; code: string; name: string; type: string; category?: string | null; }

export default function CadastrosClient({ rites, powers, chartAccounts }: { rites: Item[]; powers: Item[]; chartAccounts: ChartAccountItem[] }) {
  const router = useRouter();
  const [riteName, setRiteName] = useState('');
  const [powerName, setPowerName] = useState('');
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
    if (!window.confirm('Atualizar o plano de contas para o padrão atual? Adiciona as contas que faltam e remove as contas padrão antigas que não estão em uso.')) return;
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

  async function removeRite(id: string) {
    await fetch(`/api/rites/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  async function removePower(id: string) {
    await fetch(`/api/powers/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  async function removeChartAccount(id: string) {
    if (!window.confirm('Remover esta conta do plano de contas?')) return;
    await fetch(`/api/chart-accounts/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  const INPUT = "flex-1 rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20";
  const ADD_BTN = "rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark";

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-sand-light">Cadastros mestre</h1>
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
          <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Ritos</h2>
            <form onSubmit={createRite} className="mt-4 flex gap-3">
              <input value={riteName} onChange={(event) => setRiteName(event.target.value)} className={INPUT} placeholder="Nome do rito" />
              <button type="submit" className={ADD_BTN}>Adicionar</button>
            </form>
            <ul className="mt-6 space-y-3">
              {rites.map((rite) => (
                <li key={rite.id} className="flex items-center justify-between rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-3 text-sm text-sand-light transition-colors hover:border-white/[8%]">
                  <span>{rite.name}</span>
                  <button onClick={() => removeRite(rite.id)} className="text-sm text-rose-300 hover:text-rose-200">Remover</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Potências</h2>
            <form onSubmit={createPower} className="mt-4 flex gap-3">
              <input value={powerName} onChange={(event) => setPowerName(event.target.value)} className={INPUT} placeholder="Nome da potência" />
              <button type="submit" className={ADD_BTN}>Adicionar</button>
            </form>
            <ul className="mt-6 space-y-3">
              {powers.map((power) => (
                <li key={power.id} className="flex items-center justify-between rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-3 text-sm text-sand-light transition-colors hover:border-white/[8%]">
                  <span>{power.name}</span>
                  <button onClick={() => removePower(power.id)} className="text-sm text-rose-300 hover:text-rose-200">Remover</button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-sand-light">Plano de contas</h2>
              <p className="mt-1 text-sm text-sand-dark">Categorias de receita e despesa típicas de uma loja maçônica.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={syncChart}
                disabled={linking}
                title="Atualiza o plano de contas para o padrão atual (adiciona as que faltam, remove as antigas não utilizadas)."
                className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-all duration-200 ease-out hover:border-gold/60 hover:text-gold disabled:opacity-40"
              >
                {linking ? 'Atualizando…' : 'Atualizar plano de contas'}
              </button>
              <button
                onClick={backfillChart}
                disabled={linking || chartAccounts.length === 0}
                title="Vincula contas antigas (sem plano de contas) à categoria correspondente, para o balancete/balanço sair completo. Não altera contas já vinculadas."
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-sand-dark transition-all duration-200 ease-out hover:text-sand-light disabled:opacity-40"
              >
                {linking ? 'Vinculando…' : 'Vincular contas ao plano'}
              </button>
            </div>
          </div>
          {chartAccounts.length === 0 ? (
            <p className="mt-6 text-sm text-sand-dark">Nenhuma conta no plano. Use “Popular dados padrão (Brasil)” acima.</p>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {(['REVENUE', 'EXPENSE'] as const).map((type) => (
                <div key={type}>
                  <h3 className={`text-sm font-semibold uppercase tracking-wide ${type === 'REVENUE' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {type === 'REVENUE' ? 'Receitas' : 'Despesas'}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {chartAccounts.filter((c) => c.type === type).map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-2 text-sm text-sand">
                        <span><span className="text-sand-dark">{c.code}</span> · {c.name}</span>
                        <span className="flex items-center gap-3">
                          {c.category ? <span className="text-xs text-sand-dark">{c.category}</span> : null}
                          <button onClick={() => removeChartAccount(c.id)} className="text-xs text-rose-300/70 hover:text-rose-300">Remover</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
