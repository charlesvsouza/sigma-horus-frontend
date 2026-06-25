'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface TermItem { id: string; title: string; startDate: string; endDate?: string | null; status: string; _count: { memberOffices: number }; }

export default function VeneralatoPage() {
  const router = useRouter();
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ title: '', startDate: '', endDate: '', notes: '' });
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [termDetail, setTermDetail] = useState<any>(null);

  async function loadTerms() {
    const res = await fetch('/api/terms');
    const data = await res.json();
    setTerms(data.items ?? []);
  }

  async function loadRefs() {
    const [offRes, memRes] = await Promise.all([fetch('/api/offices'), fetch('/api/members')]);
    setOffices((await offRes.json()).items ?? []);
    setMembers((await memRes.json()).items ?? []);
  }

  useEffect(() => { loadTerms(); loadRefs(); }, []);

  async function loadTermDetail(id: string) {
    setSelectedTerm(id);
    const res = await fetch(`/api/terms/${id}`);
    const data = await res.json();
    setTermDetail(data.item);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, endDate: form.endDate || undefined, notes: form.notes || undefined }),
    });
    if (res.ok) {
      setMessage('Período criado.');
      setForm({ title: '', startDate: '', endDate: '', notes: '' });
      await loadTerms();
    }
  }

  async function assignOffice(termId: string, memberId: string, officeId: string) {
    await fetch('/api/member-offices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ termId, memberId, officeId }),
    });
    await loadTermDetail(termId);
  }

  async function closeCash(termId: string) {
    const res = await fetch('/api/cash-close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ termId }),
    });
    const data = await res.json();
    setMessage(data.item ? 'Fechamento realizado.' : data.error ?? 'Erro.');
    await loadTermDetail(termId);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Veneralato</h1>
          <p className="mt-3 text-slate-400">Gerencie períodos de gestão, cargos dos membros e fechamento de caixa.</p>
        </div>

        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Novo período</h2>
          <form onSubmit={create} className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" placeholder="Ex: Gestão 2025-2026" required />
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" required />
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3" />
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 md:col-span-2" placeholder="Observações" rows={3} />
            <button type="submit" className="rounded-full bg-amber-400 px-4 py-3 font-medium text-slate-950 md:col-span-2">Criar período</button>
          </form>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Períodos</h2>
            <div className="mt-6 space-y-3">
              {terms.map((t) => (
                <button key={t.id} onClick={() => loadTermDetail(t.id)} className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedTerm === t.id ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/10 bg-slate-950/60'}`}>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-sm text-slate-400">{new Date(t.startDate).toLocaleDateString('pt-BR')} - {t.endDate ? new Date(t.endDate).toLocaleDateString('pt-BR') : 'em aberto'} • {t._count.memberOffices} cargos</p>
                </button>
              ))}
            </div>
          </section>

          {selectedTerm && termDetail && (
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <h2 className="text-xl font-semibold">{termDetail.title}</h2>

              <div className="mt-6 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-400">Vincular cargo</h3>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <select id="mo-member" className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm">
                      <option value="">Membro</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select id="mo-office" className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm">
                      <option value="">Cargo</option>
                      {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <button onClick={() => {
                      const memberId = (document.getElementById('mo-member') as HTMLSelectElement)?.value;
                      const officeId = (document.getElementById('mo-office') as HTMLSelectElement)?.value;
                      if (memberId && officeId) assignOffice(selectedTerm, memberId, officeId);
                    }} className="rounded-full bg-amber-400 px-3 py-2 text-sm font-medium text-slate-950">Vincular</button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-400">Cargos deste período</h3>
                  <div className="mt-2 space-y-2">
                    {termDetail.memberOffices?.map((mo: any) => (
                      <div key={mo.id} className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm">
                        <span className="text-amber-300">{mo.office.name}</span>
                        <span className="mx-2 text-slate-600">—</span>
                        <span>{mo.member.name}</span>
                      </div>
                    ))}
                    {(!termDetail.memberOffices || termDetail.memberOffices.length === 0) && (
                      <p className="text-sm text-slate-500">Nenhum cargo vinculado.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-400">Fechamento de caixa</h3>
                  {termDetail.cashCloses?.length > 0 ? (
                    <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                      <p className="text-sm">Fechado em {new Date(termDetail.cashCloses[0].closedAt).toLocaleDateString('pt-BR')}</p>
                      <p className="text-sm">Saldo: R$ {termDetail.cashCloses[0].netBalance.toFixed(2)}</p>
                    </div>
                  ) : (
                    <button onClick={() => closeCash(selectedTerm)} className="mt-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950">
                      Fechar caixa deste período
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
