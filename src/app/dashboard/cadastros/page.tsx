"use client";

import { useEffect, useState } from 'react';

interface Item { id: string; name: string; order: number; }

export default function CadastrosPage() {
  const [rites, setRites] = useState<Item[]>([]);
  const [powers, setPowers] = useState<Item[]>([]);
  const [riteName, setRiteName] = useState('');
  const [powerName, setPowerName] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    const [ritesResponse, powersResponse] = await Promise.all([
      fetch('/api/rites'),
      fetch('/api/powers'),
    ]);

    const ritesData = await ritesResponse.json();
    const powersData = await powersResponse.json();
    setRites(ritesData.items ?? []);
    setPowers(powersData.items ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

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
      await loadData();
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
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao criar potência.');
    }
  }

  async function removeRite(id: string) {
    await fetch(`/api/rites/${id}`, { method: 'DELETE' });
    await loadData();
  }

  async function removePower(id: string) {
    await fetch(`/api/powers/${id}`, { method: 'DELETE' });
    await loadData();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Cadastros mestre</h1>
          <p className="mt-3 text-slate-400">Configure os ritos, potências e mantenha a estrutura da sua loja organizada.</p>
        </div>

        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Ritos</h2>
            <form onSubmit={createRite} className="mt-4 flex gap-3">
              <input value={riteName} onChange={(event) => setRiteName(event.target.value)} className="flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white" placeholder="Nome do rito" />
              <button type="submit" className="rounded-full bg-amber-400 px-4 py-3 font-medium text-slate-950">Adicionar</button>
            </form>
            <ul className="mt-6 space-y-3">
              {rites.map((rite) => (
                <li key={rite.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                  <span>{rite.name}</span>
                  <button onClick={() => removeRite(rite.id)} className="text-sm text-rose-400">Remover</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Potências</h2>
            <form onSubmit={createPower} className="mt-4 flex gap-3">
              <input value={powerName} onChange={(event) => setPowerName(event.target.value)} className="flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white" placeholder="Nome da potência" />
              <button type="submit" className="rounded-full bg-amber-400 px-4 py-3 font-medium text-slate-950">Adicionar</button>
            </form>
            <ul className="mt-6 space-y-3">
              {powers.map((power) => (
                <li key={power.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                  <span>{power.name}</span>
                  <button onClick={() => removePower(power.id)} className="text-sm text-rose-400">Remover</button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
