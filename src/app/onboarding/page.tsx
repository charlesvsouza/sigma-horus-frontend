"use client";

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', slug: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const response = await fetch('/api/lodges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? 'Não foi possível concluir o onboarding.');
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(201,162,77,0.22),_transparent_32%),linear-gradient(135deg,_#07111f_0%,_#0f172a_100%)] px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur">
        <p className="text-sm uppercase tracking-[0.25em] text-amber-300">Onboarding</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Configure sua loja e entre em operação</h1>
        <p className="mt-3 text-slate-400">Cadastre a sua loja, crie o primeiro administrador e comece a organizar ritos, potências e membros.</p>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm text-slate-300">Nome da loja</label>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white" required />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm text-slate-300">Slug da loja</label>
            <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white" placeholder="ex: loja-principal" required />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Nome do administrador</label>
            <input value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white" required />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">E-mail do administrador</label>
            <input type="email" value={form.adminEmail} onChange={(event) => setForm({ ...form, adminEmail: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white" required />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm text-slate-300">Senha</label>
            <input type="password" value={form.adminPassword} onChange={(event) => setForm({ ...form, adminPassword: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white" required />
          </div>
          {error ? <p className="md:col-span-2 text-sm text-rose-400">{error}</p> : null}
          <button type="submit" className="md:col-span-2 rounded-full bg-amber-400 px-4 py-3 font-medium text-slate-950">Criar loja e entrar</button>
        </form>
      </div>
    </main>
  );
}
