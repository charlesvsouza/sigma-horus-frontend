'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, FilePicker, Skeleton, inputClass, Alert } from '@/components/ui';
import { brl } from '@/lib/currency';

interface Donation { id: string; donorName?: string | null; anonymous: boolean; amount: number; receivedAt: string; note?: string | null; }
interface CampaignFileItem { id: string; name: string; type: string; size: number; }
interface Campaign {
  id: string; title: string; description?: string | null; beneficiaryType: string; beneficiaryName?: string | null;
  goalAmount?: number | null; fundingSource: string; fundAllocated: number; status: string;
  raised?: number; totalApplied?: number; donations?: Donation[]; files?: CampaignFileItem[];
}
interface BankAccount { id: string; name: string; isDefault: boolean }
interface Tronco { revenue: number; expense: number; balance: number; configured: boolean }
interface HospitalityRequestItem { id: string; title: string; description: string | null; status: string; createdAt: string; memberName: string; }

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
const MAX_FILES = 5;
const FILE_ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
const fileSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Envia os arquivos um a um para a campanha; devolve as mensagens de erro (vazio = tudo certo). */
async function uploadCampaignFiles(campaignId: string, files: File[]): Promise<string[]> {
  const errors: string[] = [];
  for (const file of files) {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(`/api/campaigns/${campaignId}/files`, { method: 'POST', body }).catch(() => null);
    if (!res || !res.ok) {
      const data = await res?.json().catch(() => ({}));
      errors.push(`${file.name}: ${data?.error ?? 'não foi possível enviar.'}`);
    }
  }
  return errors;
}

const STATUS_LABEL: Record<string, string> = { active: 'Ativa', completed: 'Concluída', canceled: 'Cancelada' };

export default function CampanhasClient({ items, tronco, channels, requests, bankAccounts }: { items: Campaign[]; tronco: Tronco | null; channels: Record<string, boolean>; requests: HospitalityRequestItem[]; bankAccounts: BankAccount[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const emptyForm = { title: '', description: '', beneficiaryType: 'person', beneficiaryName: '', goalAmount: '', fundingSource: 'donations' };
  const [form, setForm] = useState(emptyForm);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  async function toggleRequestReviewed(id: string, currentStatus: string) {
    setRequestBusy(id);
    await fetch(`/api/hospitality-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: currentStatus === 'pending' ? 'reviewed' : 'pending' }),
    });
    setRequestBusy(null);
    router.refresh();
  }

  async function fetchDetail(id: string) {
    const res = await fetch(`/api/campaigns/${id}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setDetail(data.item);
  }

  // Atualiza a lista/tronco (do servidor) e o detalhe aberto (client-side).
  function reload() {
    router.refresh();
    if (openId) void fetchDetail(openId);
  }

  async function openDetail(id: string) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    setDetail(null);
    await fetchDetail(id);
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (newFiles.length > MAX_FILES) { setMessage(`Anexe no máximo ${MAX_FILES} documentos.`); return; }
    setSaving(true);
    const res = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // Os documentos vão depois de criada a campanha; se algum falhar, ela já existe e dá para reenviar no detalhe.
      const errors = newFiles.length > 0 ? await uploadCampaignFiles(data.item.id, newFiles) : [];
      setMessage(errors.length > 0 ? `Campanha criada, mas nem todos os documentos foram anexados — ${errors.join(' ')} Anexe de novo abrindo a campanha.` : 'Campanha criada.');
      setCreating(false); setForm(emptyForm); setNewFiles([]); router.refresh();
    } else setMessage(data.error ?? 'Erro ao criar campanha.');
    setSaving(false);
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Campanhas de benemerência</h1>
            <p className="mt-1 text-sm text-sand-dark">Organize doações para irmãos, famílias ou instituições, com recursos do Tronco ou doação voluntária.</p>
          </div>
          <Button onClick={() => setCreating((v) => !v)}>{creating ? 'Fechar' : '+ Nova campanha'}</Button>
        </div>

        {/* Saldo do Tronco */}
        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sand-dark">Tronco de Solidariedade</p>
          {tronco?.configured ? (
            <>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums text-gold">{brl(tronco.balance)}</p>
              <p className="mt-1 text-sm text-sand-dark">Saldo disponível para benemerência (entradas {brl(tronco.revenue)} − aplicado {brl(tronco.expense)}). É a parte do dinheiro da loja reservada à benemerência: fica nos bancos e no caixa da loja e é identificada pela categoria do Tronco.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-sand-dark">As contas do Tronco ainda não estão configuradas. Em Cadastros, use <strong>“Atualizar plano de contas”</strong> para habilitar o fundo de solidariedade.</p>
          )}
        </section>

        {/* Pedidos dos obreiros */}
        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-sand-light">Pedidos dos obreiros</h2>
            {requests.some((r) => r.status === 'pending') ? (
              <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-medium text-gold">
                {requests.filter((r) => r.status === 'pending').length} pendente(s)
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-sand-dark">Pedidos de auxílio enviados pelos obreiros pela aba Hospitalaria do portal.</p>
          {requests.length === 0 ? (
            <p className="mt-4 text-sm text-sand-dark">Nenhum pedido recebido ainda.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-sand-light">
                      {r.title} <span className="ml-1 text-xs text-sand-dark">· {r.memberName}</span>
                    </p>
                    {r.description ? <p className="mt-1 text-xs text-sand-dark">{r.description}</p> : null}
                    <p className="mt-1 text-xs text-sand-dark/70">{new Date(r.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleRequestReviewed(r.id, r.status)}
                    disabled={requestBusy === r.id}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      r.status === 'pending'
                        ? 'border-gold/40 text-gold hover:border-gold/60'
                        : 'border-emerald-500/30 text-emerald-300 hover:border-emerald-500/50'
                    }`}
                  >
                    {r.status === 'pending' ? 'Marcar como analisado' : 'Analisado — reabrir'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {message ? <Alert intent="warn">{message}</Alert> : null}

        {creating ? (
          <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Nova campanha</h2>
            <form onSubmit={createCampaign} className="mt-5 space-y-4">
              <div>
                <span className="text-xs uppercase tracking-wide text-sand-dark/70">Modelo (opcional)</span>
                <select className={inputClass} value="" onChange={(e) => { const t = TEMPLATES.find((x) => x.title === e.target.value); if (t) setForm((f) => ({ ...f, title: t.title, description: t.description })); }}>
                  <option value="">Exemplos de campanha…</option>
                  {TEMPLATES.map((t) => <option key={t.title} value={t.title}>{t.title}</option>)}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Título da campanha *" required />
                <input type="number" inputMode="decimal" step="0.01" value={form.goalAmount} onChange={(e) => setForm({ ...form, goalAmount: e.target.value })} className={inputClass} placeholder="Meta (R$, opcional)" />
                <select value={form.beneficiaryType} onChange={(e) => setForm({ ...form, beneficiaryType: e.target.value })} className={inputClass}>
                  {BENEFICIARY.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
                </select>
                <input value={form.beneficiaryName} onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })} className={inputClass} placeholder="Nome do beneficiário" />
                <select value={form.fundingSource} onChange={(e) => setForm({ ...form, fundingSource: e.target.value })} className={`${inputClass} md:col-span-2`}>
                  {FUNDING.map((f) => <option key={f.v} value={f.v}>Fonte: {f.l}</option>)}
                </select>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} md:col-span-2`} placeholder="Descrição da campanha" rows={3} />
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-sand-dark/70">Documentos do pedido (opcional)</span>
                <p className="text-xs text-sand-dark">Laudo, orçamento, ofício, fotos… ajudam a formalizar o pedido. PDF ou foto, até 4 MB cada, no máximo {MAX_FILES}.</p>
                <FilePicker ariaLabel="Documentos do pedido da campanha" accept={FILE_ACCEPT} multiple buttonLabel="Anexar documentos" emptyLabel="Nenhum documento anexado" fileNames={newFiles.map((x) => x.name)} onFiles={setNewFiles} />
              </div>
              <Button type="submit" disabled={saving}>{saving ? 'Criando…' : 'Criar campanha'}</Button>
            </form>
          </section>
        ) : null}

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Campanhas</h2>
          <div className="mt-4 space-y-3">
            {items.length === 0 ? (
              <EmptyState title="Nenhuma campanha de benemerência. Que tal semear a primeira?" description="Crie a primeira campanha para mobilizar o Tronco ou os irmãos." action={<Button onClick={() => setCreating(true)}>+ Nova campanha</Button>} />
            ) : (
              items.map((c) => {
                const raised = (c.raised ?? 0) + Number(c.fundAllocated);
                const pct = c.goalAmount ? Math.min(100, Math.round((raised / c.goalAmount) * 100)) : null;
                const open = openId === c.id;
                return (
                  <div key={c.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50">
                    <button onClick={() => openDetail(c.id)} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left">
                      <div>
                        <p className="text-sm font-medium text-sand-light">{c.title} <span className="ml-1 text-xs text-sand-dark">· {STATUS_LABEL[c.status] ?? c.status}</span></p>
                        <p className="mt-0.5 text-xs text-sand-dark">{c.beneficiaryName ?? 'Sem beneficiário'} · arrecadado {brl(raised)}{c.goalAmount ? ` de ${brl(c.goalAmount)} (${pct}%)` : ''}</p>
                      </div>
                      <span className={`text-gold transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
                    </button>
                    {pct != null ? <div className="mx-4 mb-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} /></div> : null}
                    {open ? <CampaignDetail campaign={detail} tronco={tronco} channels={channels} bankAccounts={bankAccounts} onChange={reload} /> : null}
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

const CHAN_LABEL: Record<string, string> = { email: 'E-mail', whatsapp: 'WhatsApp', sms: 'SMS' };

function CampaignDetail({ campaign, tronco, channels, bankAccounts, onChange }: { campaign: Campaign | null; tronco: Tronco | null; channels: Record<string, boolean>; bankAccounts: BankAccount[]; onChange: () => void }) {
  const [donation, setDonation] = useState({ amount: '', donorName: '', anonymous: false });
  const [fund, setFund] = useState('');
  const [bankAccountId, setBankAccountId] = useState(() => (bankAccounts.find((a) => a.isDefault) ?? bankAccounts[0])?.id ?? '');
  const [msg, setMsg] = useState('');
  const [conv, setConv] = useState({ email: true, whatsapp: false, sms: false, scope: 'active', message: '' });
  const [convResult, setConvResult] = useState('');
  const [convBusy, setConvBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);

  async function convocar() {
    setConvResult('');
    const selected = (['email', 'whatsapp', 'sms'] as const).filter((c) => conv[c]);
    if (selected.length === 0) { setConvResult('Selecione ao menos um canal.'); return; }
    setConvBusy(true);
    const res = await fetch(`/api/campaigns/${campaign!.id}/convocar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channels: selected, scope: conv.scope, message: conv.message }) });
    const data = await res.json().catch(() => ({}));
    setConvBusy(false);
    if (res.ok) {
      const s = data.stats ?? {};
      setConvResult(`Convocação: ${s.sent ?? 0} enviadas, ${s.queued ?? 0} enfileiradas, ${s.failed ?? 0} falhas, ${s.skipped ?? 0} sem contato.`);
    } else setConvResult(data.error ?? 'Erro ao convocar.');
  }

  if (!campaign) return <div className="border-t border-white/5 px-4 py-4"><Skeleton variant="text" className="w-1/2" /></div>;

  async function addDonation(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const res = await fetch(`/api/campaigns/${campaign!.id}/donations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...donation, amount: Number(donation.amount), bankAccountId: bankAccountId || undefined }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setDonation({ amount: '', donorName: '', anonymous: false }); onChange(); }
    else setMsg(data.error ?? 'Erro ao registrar doação.');
  }
  async function fundFromTronco(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const res = await fetch(`/api/campaigns/${campaign!.id}/fund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(fund), bankAccountId: bankAccountId || undefined }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setFund(''); onChange(); }
    else setMsg(data.error ?? 'Erro ao custear pelo Tronco.');
  }
  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setMsg('');
    setFileBusy(true);
    const errors = await uploadCampaignFiles(campaign!.id, files);
    setFileBusy(false);
    if (errors.length > 0) setMsg(errors.join(' '));
    onChange();
  }
  async function removeFile(file: CampaignFileItem) {
    if (!window.confirm(`Remover o documento "${file.name}"?`)) return;
    setMsg('');
    const res = await fetch(`/api/campaigns/${campaign!.id}/files/${file.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data.error ?? 'Erro ao remover o documento.');
    onChange();
  }
  async function setStatus(status: string) {
    await fetch(`/api/campaigns/${campaign!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    onChange();
  }

  return (
    <div className="space-y-5 border-t border-white/5 bg-sigma-blue-deep/30 px-4 py-5 text-sm">
      {campaign.description ? <p className="text-sand">{campaign.description}</p> : null}
      {msg ? <p className="text-xs text-rose-300">{msg}</p> : null}
      {bankAccounts.length > 0 ? (
        <label className="block text-xs text-sand-dark">Conta ou caixa da loja (onde a doação entra ou de onde o custeio sai)
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={`mt-1 ${inputClass}`}>
            {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Doação voluntária */}
        <form onSubmit={addDonation} className="space-y-2 rounded-lg border border-white/6 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">Registrar doação</p>
          <input type="number" inputMode="decimal" step="0.01" value={donation.amount} onChange={(e) => setDonation({ ...donation, amount: e.target.value })} className={inputClass} placeholder="Valor *" required />
          <input value={donation.donorName} onChange={(e) => setDonation({ ...donation, donorName: e.target.value })} className={inputClass} placeholder="Nome do doador" disabled={donation.anonymous} />
          <label className="flex items-center gap-2 text-xs text-sand-dark"><input type="checkbox" checked={donation.anonymous} onChange={(e) => setDonation({ ...donation, anonymous: e.target.checked })} className="accent-gold" /> Doador anônimo</label>
          <Button type="submit" size="sm">Registrar</Button>
        </form>

        {/* Custeio pelo Tronco */}
        <form onSubmit={fundFromTronco} className="space-y-2 rounded-lg border border-white/6 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">Custear pelo Tronco</p>
          <p className="text-xs text-sand-dark">Disponível: {tronco?.configured ? brl(tronco.balance) : '—'}. Já custeado: {brl(Number(campaign.fundAllocated))}.</p>
          <input type="number" inputMode="decimal" step="0.01" value={fund} onChange={(e) => setFund(e.target.value)} className={inputClass} placeholder="Valor a custear" disabled={!tronco?.configured} />
          <Button type="submit" size="sm" variant="secondary" disabled={!tronco?.configured}>Custear</Button>
        </form>
      </div>

      {/* Documentos do pedido */}
      <div className="rounded-lg border border-white/6 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">Documentos do pedido ({campaign.files?.length ?? 0})</p>
        {campaign.files && campaign.files.length > 0 ? (
          <ul className="mt-2 divide-y divide-white/5">
            {campaign.files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <a href={`/api/campaigns/${campaign.id}/files/${f.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words text-sand underline-offset-2 hover:text-gold hover:underline">{f.name} <span className="text-xs text-sand-dark">· {fileSize(f.size)}</span></a>
                {campaign.status === 'active' ? <button type="button" onClick={() => removeFile(f)} className="text-xs text-rose-300 hover:text-rose-200">Remover</button> : null}
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-xs text-sand-dark">Nenhum documento anexado. É opcional, mas laudo, orçamento ou ofício ajudam a formalizar o pedido.</p>}
        {campaign.status === 'active' && (campaign.files?.length ?? 0) < MAX_FILES ? (
          <div className="mt-3">
            <FilePicker ariaLabel="Anexar documentos à campanha" accept={FILE_ACCEPT} multiple disabled={fileBusy} buttonLabel={fileBusy ? 'Enviando…' : 'Anexar documentos'} emptyLabel={`PDF ou foto, até 4 MB (máx. ${MAX_FILES})`} onFiles={addFiles} />
          </div>
        ) : null}
      </div>

      {/* Doações registradas */}
      {campaign.donations && campaign.donations.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">Doações ({campaign.donations.length})</p>
          <ul className="mt-1 divide-y divide-white/5">
            {campaign.donations.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-1.5">
                <span className="text-sand">{d.anonymous ? 'Doador anônimo' : d.donorName || 'Doador não identificado'}</span>
                <span className="tabular-nums text-sand-dark">{brl(Number(d.amount))} · {new Date(d.receivedAt).toLocaleDateString('pt-BR')}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Convocação dos irmãos */}
      <div className="rounded-lg border border-white/6 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">Convocar os irmãos</p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          {(['email', 'whatsapp', 'sms'] as const).map((c) => (
            <label key={c} className="flex items-center gap-2 text-xs text-sand">
              <input type="checkbox" checked={conv[c]} onChange={(e) => setConv({ ...conv, [c]: e.target.checked })} className="accent-gold" />
              {CHAN_LABEL[c]}{!channels[c] ? <span className="text-sand-dark/60"> (registra; envio na Fase 7)</span> : null}
            </label>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-sand-dark">
            Para:
            <select value={conv.scope} onChange={(e) => setConv({ ...conv, scope: e.target.value })} className={`${inputClass} w-auto py-1.5`}>
              <option value="active">Irmãos ativos</option>
              <option value="all">Todos os irmãos</option>
            </select>
          </label>
        </div>
        <textarea value={conv.message} onChange={(e) => setConv({ ...conv, message: e.target.value })} className={`${inputClass} mt-2`} placeholder="Mensagem (opcional — em branco, usa um texto padrão com o resumo da campanha)" rows={2} />
        <div className="mt-2 flex items-center gap-3">
          <Button size="sm" onClick={convocar} disabled={convBusy}>{convBusy ? 'Enviando…' : 'Convocar'}</Button>
          {convResult ? <span className="text-xs text-sand-dark">{convResult}</span> : null}
        </div>
      </div>

      {campaign.status === 'active' ? (
        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={() => setStatus('completed')} className="rounded-full border border-emerald-500/40 px-4 py-2 text-xs font-medium text-emerald-300 transition-all hover:border-emerald-500/60">Concluir campanha</button>
          <button onClick={() => setStatus('canceled')} className="rounded-full border border-rose-500/40 px-4 py-2 text-xs font-medium text-rose-300 transition-all hover:border-rose-500/60">Cancelar</button>
        </div>
      ) : null}
    </div>
  );
}
