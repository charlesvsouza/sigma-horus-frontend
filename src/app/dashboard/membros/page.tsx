"use client";

import { useEffect, useState } from 'react';

interface Option { id: string; name: string; }
interface Member { id: string; name: string; email?: string | null; phone?: string | null; status: string; gradeName?: string | null; rite?: Option | null; power?: Option | null; }

export default function MembrosPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [rites, setRites] = useState<Option[]>([]);
  const [powers, setPowers] = useState<Option[]>([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', status: 'active', gradeName: '', riteId: '', powerId: '' });
  const [message, setMessage] = useState('');

  async function loadData() {
    const [membersResponse, ritesResponse, powersResponse] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/rites'),
      fetch('/api/powers'),
    ]);

    const membersData = await membersResponse.json();
    const ritesData = await ritesResponse.json();
    const powersData = await powersResponse.json();
    setMembers(membersData.items ?? []);
    setRites(ritesData.items ?? []);
    setPowers(powersData.items ?? []);
  }

  useEffect(() => { loadData(); }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, riteId: form.riteId || undefined, powerId: form.powerId || undefined }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage('Membro cadastrado com sucesso.');
      setForm({ name: '', email: '', phone: '', status: 'active', gradeName: '', riteId: '', powerId: '' });
      await loadData();
    } else {
      setMessage(data.error ?? 'Erro ao cadastrar membro.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Membros</h1>
          <p className="mt-3 text-slate-400">Cadastre membros e vincule ritos, potências e grau.</p>
        </div>

        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Novo membro</h2>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Nome completo" required />
            <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="E-mail" />
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Telefone" />
            <input value={form.gradeName} onChange={(event) => setForm({ ...form, gradeName: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Grau" />
            <select value={form.riteId} onChange={(event) => setForm({ ...form, riteId: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
              <option value="">Selecione um rito</option>
              {rites.map((rite) => <option key={rite.id} value={rite.id}>{rite.name}</option>)}
            </select>
            <select value={form.powerId} onChange={(event) => setForm({ ...form, powerId: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
              <option value="">Selecione uma potência</option>
              {powers.map((power) => <option key={power.id} value={power.id}>{power.name}</option>)}
            </select>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2">
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="suspended">Suspenso</option>
            </select>
            <button type="submit" className="rounded-full bg-amber-400 px-4 py-3 font-medium text-slate-950 md:col-span-2">Salvar membro</button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Listagem</h2>
          <div className="mt-6 space-y-3">
            {members.map((member) => (
              <div key={member.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-slate-400">{member.email ?? 'Sem e-mail'} • {member.phone ?? 'Sem telefone'}</p>
                  </div>
                  <div className="text-sm text-slate-400">
                    <p>Rito: {member.rite?.name ?? '—'}</p>
                    <p>Potência: {member.power?.name ?? '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
