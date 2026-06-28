'use client';

import { useEffect, useState } from 'react';
import { Button, EmptyState, Skeleton, inputClass } from '@/components/ui';

interface Donation { id: string; donorName?: string | null; anonymous: boolean; amount: number; receivedAt: string; note?: string | null; }
interface Campaign {
  id: string; title: string; description?: string | null; beneficiaryType: string; beneficiaryName?: string | null;
  goalAmount?: number | null; fundingSource: string; fundAllocated: number; status: string;
  raised?: number; totalApplied?: number; donations?: Donation[];
}
interface Tronco { revenue: number; expense: number; balance: number; configured: boolean }

const BENEFICIARY = [{ v: 'person', l: 'Pessoa física' }, { v: 'company', l: 'Empresa' }, { v: 'institution', l: 'Instituição' }];
const FUNDING = [{ v: 'donations', l: 'Doação voluntária dos irmãos' }, { v: 'fund', l: 'Tronco de Solidariedade' }, { v: 'mixed', l: 'Tronco + doações' }];
const TEMPLATES = [
  { title: 'Cadeira de rodas', description: 'Aquisição de cadeira de rodas para irmão, familiar ou assistido.' },
  { title: 'Cesta básica', description: 'Cesta(s) básica(s) para família em necessidade.' },
  { title: 'Auxílio funeral', description: 'Apoio às despesas de funeral de irmão ou dependente.' },
  { title: 'Material escolar', description: 'Material escolar para crianças assistidas.' },
  { title: 'Medicamentos', description: 'Compra de medicamentos para tratamento de saúde.' },
  { title: 'Doação a instituição', description: 'Doação a entidade assistencial (asilo, abrigo, etc.).' },
];
const STATUS_LABEL: Record<string, string> = { active: 'Ativa', completed: 'Concluída', canceled: 'Cancelada' };
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CampanhasPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [tronco, setTronco] = useState<Tronco | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const emptyForm = { title: '', description: '', beneficiaryType: 'person', beneficiaryName: '', goalAmount: '', fundingSource: 'donations' };
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/campaigns');
    const data = await res.json();
    setItems(data.items ?? []);
    setTronco(data.tronco ?? null);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function openDetail(id: string) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    setDetail(null);
    const res = await fetch(`/api/campaigns/${id}`);
    const data = await res.json();
    if (res.ok) setDetail(data.item);
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (res.ok) { setMessage('Campanha criada.'); setCreating(false); setForm(emptyForm); await load(); }
    else setMessage(data.error ?? 'Erro ao criar campanha.');
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-sand-light">Campanhas de benemerência</h1>
            <p className="mt-1 text-sm text-sand-dark">Organize doações para irmãos, famílias ou instituições, com recursos do Tronco ou doação voluntária.</p>
          </div>
          <Button onClick={() => setCreating((v) => !v)}>{creating ? 'Fechar' : '+ Nova campanha'}</Button>
        </div>

        {/* Saldo do Tronco */}
        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sand-dark">Tronco de Solidariedade</p>
          {tronco?.configured ? (
            <>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums text-gold">{brl(tronco.balance)}</p>
              <p className="mt-1 text-sm text-sand-dark">Saldo disponível para benemerência (entradas {brl(tronco.revenue)} − aplicado {brl(tronco.expense)}). Faz parte do caixa total, em conta separada.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-sand-dark">As contas do Tronco ainda não estão configuradas. Em Cadastros, use <strong>“Atualizar plano de contas”</strong> para habilitar o fundo de solidariedade.</p>
          )}
        </section>

        {message ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div> : null}

        {creating ? (
          <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
            <h2 className="text-base font-semibold text-sand-light">Nova campanha</h2>
            <form onSubmit={createCampaign} className="mt-5 space-y-4">
              <div>
                <span className="text-[11px] uppercase tracking-wide text-sand-dark/70">Modelo (opcional)</span>
                <select className={inputClass} value="" onChange={(e) => { const t = TEMPLATES.find((x) => x.title === e.target.value); if (t) setForm((f) => ({ ...f, title: t.title, description: t.description })); }}>
                  <option value="">Exemplos de campanha…</option>
                  {TEMPLATES.map((t) => <option key={t.title} value={t.title}>{t.title}</option>)}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Título da campanha *" required />
                <input type="number" step="0.01" value={form.goalAmount} onChange={(e) => setForm({ ...form, goalAmount: e.target.value })} className={inputClass} placeholder="Meta (R$, opcional)" />
                <select value={form.beneficiaryType} onChange={(e) => setForm({ ...form, beneficiaryType: e.target.value })} className={inputClass}>
                  {BENEFICIARY.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
                </select>
                <input value={form.beneficiaryName} onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })} className={inputClass} placeholder="Nome do beneficiário" />
                <select value={form.fundingSource} onChange={(e) => setForm({ ...form, fundingSource: e.target.value })} className={`${inputClass} md:col-span-2`}>
                  {FUNDING.map((f) => <option key={f.v} value={f.v}>Fonte: {f.l}</option>)}
                </select>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} md:col-span-2`} placeholder="Descrição da campanha" rows={3} />
              </div>
              <Button type="submit">Criar campanha</Button>
            </form>
          </section>
        ) : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Campanhas</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="card" className="h-20" />)
            ) : items.length === 0 ? (
              <EmptyState title="Nenhuma campanha" description="Crie a primeira campanha de benemerência para mobilizar o Tronco ou os irmãos." action={<Button onClick={() => setCreating(true)}>+ Nova campanha</Button>} />
            ) : (
              items.map((c) => {
                const raised = (c.raised ?? 0) + Number(c.fundAllocated);
                const pct = c.goalAmount ? Math.min(100, Math.round((raised / c.goalAmount) * 100)) : null;
                const open = openId === c.id;
                return (
                  <div key={c.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50">
                    <button onClick={() => openDetail(c.id)} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left">
                      <div>
                        <p className="text-sm font-medium text-sand-light">{c.title} <span className="ml-1 text-xs text-sand-dark">· {STATUS_LABEL[c.status] ?? c.status}</span></p>
                        <p className="mt-0.5 text-xs text-sand-dark">{c.beneficiaryName ?? 'Sem beneficiário'} · arrecadado {brl(raised)}{c.goalAmount ? ` de ${brl(c.goalAmount)} (${pct}%)` : ''}</p>
                      </div>
                      <span className={`text-gold transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
                    </button>
                    {pct != null ? <div className="mx-4 mb-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} /></div> : null}
                    {open ? <CampaignDetail campaign={detail} tronco={tronco} onChange={load} /> : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function CampaignDetail({ campaign, tronco, onChange }: { campaign: Campaign | null; tronco: Tronco | null; onChange: () => void }) {
  const [donation, setDonation] = useState({ amount: '', donorName: '', anonymous: false });
  const [fund, setFund] = useState('');
  const [msg, setMsg] = useState('');

  if (!campaign) return <div className="border-t border-white/[5%] px-4 py-4"><Skeleton variant="text" className="w-1/2" /></div>;

  async function addDonation(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const res = await fetch(`/api/campaigns/${campaign!.id}/donations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...donation, amount: Number(donation.amount) }) });
    const data = await res.json();
    if (res.ok) { setDonation({ amount: '', donorName: '', anonymous: false }); onChange(); }
    else setMsg(data.error ?? 'Erro ao registrar doação.');
  }
  async function fundFromTronco(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const res = await fetch(`/api/campaigns/${campaign!.id}/fund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(fund) }) });
    const data = await res.json();
    if (res.ok) { setFund(''); onChange(); }
    else setMsg(data.error ?? 'Erro ao custear pelo Tronco.');
  }
  async function setStatus(status: string) {
    await fetch(`/api/campaigns/${campaign!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    onChange();
  }

  return (
    <div className="space-y-5 border-t border-white/[5%] bg-sigma-blue-deep/30 px-4 py-5 text-sm">
      {campaign.description ? <p className="text-sand">{campaign.description}</p> : null}
      {msg ? <p className="text-xs text-rose-300">{msg}</p> : null}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Doação voluntária */}
        <form onSubmit={addDonation} className="space-y-2 rounded-lg border border-white/[6%] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">Registrar doação</p>
          <input type="number" step="0.01" value={donation.amount} onChange={(e) => setDonation({ ...donation, amount: e.target.value })} className={inputClass} placeholder="Valor *" required />
          <input value={donation.donorName} onChange={(e) => setDonation({ ...donation, donorName: e.target.value })} className={inputClass} placeholder="Nome do doador" disabled={donation.anonymous} />
          <label className="flex items-center gap-2 text-xs text-sand-dark"><input type="checkbox" checked={donation.anonymous} onChange={(e) => setDonation({ ...donation, anonymous: e.target.checked })} className="accent-gold" /> Doador anônimo</label>
          <Button type="submit" size="sm">Registrar</Button>
        </form>

        {/* Custeio pelo Tronco */}
        <form onSubmit={fundFromTronco} className="space-y-2 rounded-lg border border-white/[6%] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">Custear pelo Tronco</p>
          <p className="text-xs text-sand-dark">Disponível: {tronco?.configured ? brl(tronco.balance) : '—'}. Já custeado: {brl(Number(campaign.fundAllocated))}.</p>
          <input type="number" step="0.01" value={fund} onChange={(e) => setFund(e.target.value)} className={inputClass} placeholder="Valor a custear" disabled={!tronco?.configured} />
          <Button type="submit" size="sm" variant="secondary" disabled={!tronco?.configured}>Custear</Button>
        </form>
      </div>

      {/* Doações registradas */}
      {campaign.donations && campaign.donations.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">Doações ({campaign.donations.length})</p>
          <ul className="mt-1 divide-y divide-white/[5%]">
            {campaign.donations.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-1.5">
                <span className="text-sand">{d.anonymous ? 'Doador anônimo' : d.donorName || 'Doador não identificado'}</span>
                <span className="tabular-nums text-sand-dark">{brl(Number(d.amount))} · {new Date(d.receivedAt).toLocaleDateString('pt-BR')}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {campaign.status === 'active' ? (
        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={() => setStatus('completed')} className="rounded-full border border-emerald-500/40 px-4 py-2 text-xs font-medium text-emerald-300 transition-all hover:border-emerald-500/60">Concluir campanha</button>
          <button onClick={() => setStatus('canceled')} className="rounded-full border border-rose-500/40 px-4 py-2 text-xs font-medium text-rose-300 transition-all hover:border-rose-500/60">Cancelar</button>
        </div>
      ) : null}
    </div>
  );
}
