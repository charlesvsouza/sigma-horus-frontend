'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

interface SessionItem { id: string; title: string; date: string; type: string; grade?: string | null; notes?: string | null; _count: { attendances: number }; }

export default function SessoesPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', date: '', type: 'ordinary', grade: '', notes: '' });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/sessions');
    const data = await res.json();
    setSessions(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, grade: form.grade || undefined, notes: form.notes || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage('Sessão criada.');
      setForm({ title: '', date: '', type: 'ordinary', grade: '', notes: '' });
      await load();
    } else {
      setMessage(data.error ?? 'Erro.');
    }
  }

  async function remove(id: string) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    await load();
  }

  const typeLabel: Record<string, string> = { ordinary: 'Ordinária', magnificent: 'Magnífica', emergency: 'Extraordinária', other: 'Outra' };

  const INPUT = "w-full rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20";

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-sand-light">Sessões</h1>
          <p className="mt-1 text-sm text-sand-dark">Cadastre sessões da loja e registre presença dos membros.</p>
        </div>

        {message ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Nova sessão</h2>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={INPUT} placeholder="Título da sessão" required />
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={INPUT} required />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={INPUT}>
              <option value="ordinary">Ordinária</option>
              <option value="magnificent">Magnífica</option>
              <option value="emergency">Extraordinária</option>
              <option value="other">Outra</option>
            </select>
            <input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className={INPUT} placeholder="Grau (opcional)" />
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${INPUT} md:col-span-2`} placeholder="Observações" rows={3} />
            <button type="submit" className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark md:col-span-2">Criar sessão</button>
          </form>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Sessões cadastradas</h2>
          <div className="mt-5 space-y-3">
            {loading ? <p className="text-sm text-sand-dark">Carregando...</p> : sessions.length === 0 ? <p className="text-sm text-sand-dark">Nenhuma sessão cadastrada.</p> : sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 transition-colors hover:border-white/[8%]">
                <div>
                  <p className="text-sm font-medium text-sand-light">{s.title}</p>
                  <p className="mt-1 text-xs text-sand-dark">{typeLabel[s.type] ?? s.type} • {s._count.attendances} presentes</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-sand-dark">
                  <Link href={`/dashboard/sessoes/${s.id}`} className="text-gold hover:text-gold-light">Presença</Link>
                  <span>{new Date(s.date).toLocaleDateString('pt-BR')}</span>
                  <button onClick={() => remove(s.id)} className="text-rose-300 hover:text-rose-200">Remover</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
