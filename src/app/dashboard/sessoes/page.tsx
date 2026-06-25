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

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Sessões</h1>
          <p className="mt-3 text-slate-400">Cadastre sessões da loja e registre presença dos membros.</p>
        </div>

        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Nova sessão</h2>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Título da sessão" required />
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" required />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
              <option value="ordinary">Ordinária</option>
              <option value="magnificent">Magnífica</option>
              <option value="emergency">Extraordinária</option>
              <option value="other">Outra</option>
            </select>
            <input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Grau (opcional)" />
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2" placeholder="Observações" rows={3} />
            <button type="submit" className="rounded-full bg-amber-400 px-4 py-3 font-medium text-slate-950 md:col-span-2">Criar sessão</button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Sessões cadastradas</h2>
          <div className="mt-6 space-y-3">
            {loading ? <p className="text-sm text-slate-500">Carregando...</p> : sessions.length === 0 ? <p className="text-sm text-slate-500">Nenhuma sessão cadastrada.</p> : sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-slate-400">{typeLabel[s.type] ?? s.type} • {s._count.attendances} presentes</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <Link href={`/dashboard/sessoes/${s.id}`} className="text-amber-300 hover:text-amber-200">Presença</Link>
                  <span>{new Date(s.date).toLocaleDateString('pt-BR')}</span>
                  <button onClick={() => remove(s.id)} className="text-rose-400">Remover</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
