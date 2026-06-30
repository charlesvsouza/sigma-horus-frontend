'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Office { id: string; name: string; order: number; }

export default function CargosClient({ offices }: { offices: Office[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

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
      router.refresh();
    }
  }

  async function remove(id: string) {
    await fetch(`/api/offices/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-sand-light">Cargos</h1>
          <p className="mt-1 text-sm text-sand-dark">Cadastre os cargos da loja (Venerável, Tesoureiro, Secretário...).</p>
        </div>
        {message ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}
        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <form onSubmit={create} className="flex gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20" placeholder="Nome do cargo" required />
            <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Adicionar</button>
          </form>
          <div className="mt-6 space-y-2">
            {offices.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-3 transition-colors hover:border-white/[8%]">
                <span className="text-sm text-sand-light">{o.name}</span>
                <button onClick={() => remove(o.id)} className="text-sm text-rose-300 hover:text-rose-200">Remover</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
