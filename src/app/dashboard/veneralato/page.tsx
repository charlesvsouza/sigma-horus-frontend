'use client';

import { use, useEffect, useState } from 'react';
import { Button, inputClass } from '@/components/ui';
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
  const [role, setRole] = useState('');

  useEffect(() => {
    fetch('/api/auth/session').then((r) => r.json()).then((s) => setRole(String(s?.user?.role ?? '').toLowerCase())).catch(() => {});
  }, []);
  const isAdmin = role === 'admin';
  const isVenerable = role === 'venerable';
  const canClose = isAdmin || role === 'treasurer';

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
    setMessage(data.item ? 'Caixa fechado. Aguarda aprovação da prestação de contas.' : data.error ?? 'Erro.');
    await loadTermDetail(termId);
  }

  async function approveAccounts(termId: string) {
    if (!confirm('Aprovar a prestação de contas deste período? Após aprovada, o Admin poderá encerrar o veneralato.')) return;
    const res = await fetch('/api/cash-close/approve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ termId }),
    });
    const data = await res.json();
    setMessage(res.ok ? 'Prestação de contas aprovada.' : data.error ?? 'Erro.');
    await loadTermDetail(termId);
  }

  async function closeTerm(termId: string) {
    if (!confirm('Encerrar o veneralato? Esta ação trava todos os lançamentos do período e o saldo final será herdado pela próxima gestão. Não pode ser desfeita.')) return;
    const res = await fetch(`/api/terms/${termId}/close`, { method: 'POST' });
    const data = await res.json();
    setMessage(res.ok ? `Veneralato encerrado. Saldo final R$ ${Number(data.closingBalance ?? 0).toFixed(2)} será herdado pela próxima gestão.` : data.error ?? 'Erro.');
    await loadTermDetail(termId);
    await loadTerms();
  }

  const brl = (n: number) => `R$ ${Number(n ?? 0).toFixed(2)}`;

  const INPUT = inputClass; // fonte única do design system

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-sand-light">Veneralato</h1>
          <p className="mt-1 text-sm text-sand-dark">Gerencie períodos de gestão, cargos dos membros e fechamento de caixa.</p>
        </div>

        {message ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Novo período</h2>
          <form onSubmit={create} className="mt-5 grid gap-4 md:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={INPUT} placeholder="Ex: Gestão 2025-2026" required />
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={INPUT} required />
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={INPUT} />
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${INPUT} md:col-span-2`} placeholder="Observações" rows={3} />
            <Button type="submit" className="md:col-span-2">Criar período</Button>
          </form>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
            <h2 className="text-base font-semibold text-sand-light">Períodos</h2>
            <div className="mt-5 space-y-3">
              {terms.map((t) => (
                <button key={t.id} onClick={() => loadTermDetail(t.id)} className={`w-full rounded-lg border px-4 py-4 text-left transition-colors ${selectedTerm === t.id ? 'border-gold/40 bg-gold/10' : 'border-white/[5%] bg-sigma-blue-deep/50 hover:border-white/[8%]'}`}>
                  <p className="text-sm font-medium text-sand-light">{t.title}</p>
                  <p className="mt-1 text-xs text-sand-dark">{new Date(t.startDate).toLocaleDateString('pt-BR')} - {t.endDate ? new Date(t.endDate).toLocaleDateString('pt-BR') : 'em aberto'} • {t._count.memberOffices} cargos</p>
                </button>
              ))}
            </div>
          </section>

          {selectedTerm && termDetail && (
            <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-sand-light">{termDetail.title}</h2>
                {termDetail.status === 'closed'
                  ? <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-sand-dark">encerrado</span>
                  : <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">em exercício</span>}
              </div>
              <p className="mt-1 text-xs text-sand-dark">Saldo herdado da gestão anterior: <span className="text-sand-light">{brl(termDetail.openingBalance ?? 0)}</span></p>

              <div className="mt-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-sand-dark">Vincular cargo</h3>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <select id="mo-member" className="rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20">
                      <option value="">Membro</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select id="mo-office" className="rounded-lg border border-white/[8%] bg-sigma-blue-deep/60 px-3 py-2 text-sm text-sand-light outline-none transition-all duration-200 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/20">
                      <option value="">Cargo</option>
                      {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <button onClick={() => {
                      const memberId = (document.getElementById('mo-member') as HTMLSelectElement)?.value;
                      const officeId = (document.getElementById('mo-office') as HTMLSelectElement)?.value;
                      if (memberId && officeId) assignOffice(selectedTerm, memberId, officeId);
                    }} className="rounded-full bg-gold px-3 py-2 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light active:bg-gold-dark">Vincular</button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-sand-dark">Cargos deste período</h3>
                  <div className="mt-2 space-y-2">
                    {termDetail.memberOffices?.map((mo: any) => (
                      <div key={mo.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-2 text-sm text-sand">
                        <span className="text-gold">{mo.office.name}</span>
                        <span className="mx-2 text-sand-dark">—</span>
                        <span>{mo.member.name}</span>
                      </div>
                    ))}
                    {(!termDetail.memberOffices || termDetail.memberOffices.length === 0) && (
                      <p className="text-sm text-sand-dark">Nenhum cargo vinculado.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-sand-dark">Encerramento do veneralato</h3>
                  {(() => {
                    const close = termDetail.cashCloses?.[0] ?? null;
                    const closed = termDetail.status === 'closed';
                    return (
                      <div className="mt-2 space-y-3">
                        {/* Passo 1 — Tesoureiro fecha o caixa */}
                        <div className="rounded-lg border border-white/[6%] bg-sigma-blue-deep/50 px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-sand">1. Fechamento de caixa <span className="text-xs text-sand-dark">(Tesoureiro)</span></span>
                            {close ? <span className="text-xs text-emerald-300">✓ feito</span> : null}
                          </div>
                          {close ? (
                            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-sand-dark">
                              <span>Abertura: <span className="text-sand-light">{brl(close.openingBalance)}</span></span>
                              <span>Entradas: <span className="text-sand-light">{brl(close.totalPayments)}</span></span>
                              <span>Saídas: <span className="text-sand-light">{brl(close.totalPayables)}</span></span>
                              <span>Saldo final: <span className="text-gold">{brl(close.closingBalance)}</span></span>
                            </div>
                          ) : canClose && !closed ? (
                            <button onClick={() => closeCash(selectedTerm)} className="mt-2 rounded-full bg-gold px-4 py-2 text-sm font-medium text-sigma-blue-deep transition-all hover:bg-gold-light active:bg-gold-dark">Fechar caixa deste período</button>
                          ) : <p className="mt-1 text-xs text-sand-dark">Aguardando o Tesoureiro fechar o caixa.</p>}
                        </div>

                        {/* Passo 2 — Venerável aprova a prestação de contas */}
                        <div className="rounded-lg border border-white/[6%] bg-sigma-blue-deep/50 px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-sand">2. Prestação de contas <span className="text-xs text-sand-dark">(Venerável)</span></span>
                            {close?.approved ? <span className="text-xs text-emerald-300">✓ aprovada</span> : null}
                          </div>
                          {close && !close.approved && (isVenerable || isAdmin) ? (
                            <button onClick={() => approveAccounts(selectedTerm)} className="mt-2 rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-all hover:border-gold/60 hover:text-gold">Aprovar prestação de contas</button>
                          ) : !close ? <p className="mt-1 text-xs text-sand-dark">Disponível após o fechamento de caixa.</p>
                          : !close.approved ? <p className="mt-1 text-xs text-sand-dark">Aguardando aprovação do Venerável.</p> : null}
                        </div>

                        {/* Passo 3 — Admin encerra o veneralato */}
                        <div className="rounded-lg border border-white/[6%] bg-sigma-blue-deep/50 px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-sand">3. Encerrar veneralato <span className="text-xs text-sand-dark">(Admin)</span></span>
                            {closed ? <span className="text-xs text-emerald-300">✓ encerrado</span> : null}
                          </div>
                          {closed ? (
                            <p className="mt-1 text-xs text-sand-dark">Encerrado em {termDetail.closedAt ? new Date(termDetail.closedAt).toLocaleDateString('pt-BR') : '—'}. Lançamentos do período travados; saldo herdado pela próxima gestão.</p>
                          ) : close?.approved && isAdmin ? (
                            <button onClick={() => closeTerm(selectedTerm)} className="mt-2 rounded-full border border-rose-500/40 px-4 py-2 text-sm font-medium text-rose-300 transition-all hover:border-rose-500/60 hover:text-rose-200">Encerrar veneralato</button>
                          ) : <p className="mt-1 text-xs text-sand-dark">Disponível após a aprovação da prestação de contas.</p>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
