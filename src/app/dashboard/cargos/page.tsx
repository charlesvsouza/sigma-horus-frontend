'use client';

import { useEffect, useState } from 'react';

export default function CargosPage() {
  const [offices, setOffices] = useState<{ id: string; name: string; order: number }[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const res = await fetch('/api/offices');
    const data = await res.json();
    setOffices(data.items ?? []);
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/offices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, order: offices.length + 1 }),
    });
    if (res.ok) {
      setMessage('Cargo criado.');
      setName('');
      await load();
    }
  }

  async function remove(id: string) {
    await fetch(`/api/offices/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Cargos</h1>
          <p className="mt-3 text-slate-400">Cadastre os cargos da loja (Venerável, Tesoureiro, Secretário...).</p>
        </div>
        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}
        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <form onSubmit={create} className="flex gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Nome do cargo" required />
            <button type="submit" className="rounded-full bg-amber-400 px-5 py-3 font-medium text-slate-950">Adicionar</button>
          </form>
          <div className="mt-6 space-y-2">
            {offices.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <span>{o.name}</span>
                <button onClick={() => remove(o.id)} className="text-sm text-rose-400">Remover</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
