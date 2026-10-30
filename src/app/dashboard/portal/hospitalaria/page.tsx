'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, FilePicker, inputClass, Toast } from '@/components/ui';
import { brl } from '@/lib/currency';

interface CampaignItem {
  id: string;
  title: string;
  description: string | null;
  beneficiaryType: string;
  beneficiaryName: string | null;
  goalAmount: number | null;
  raised: number;
  status: string;
}

interface RequestFile { id: string; name: string; size: number }
interface MyRequest { id: string; title: string; description: string | null; status: string; createdAt: string; files: RequestFile[] }

const STATUS_LABEL: Record<string, string> = { active: 'Ativa', completed: 'Concluída', canceled: 'Cancelada' };
const MAX_FILES = 5;
const FILE_ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
const fileSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Envia os arquivos um a um para o pedido; devolve as mensagens de erro (vazio = tudo certo). */
async function uploadRequestFiles(requestId: string, files: File[]): Promise<string[]> {
  const errors: string[] = [];
  for (const file of files) {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(`/api/hospitality-requests/${requestId}/files`, { method: 'POST', body }).catch(() => null);
    if (!res || !res.ok) {
      const data = await res?.json().catch(() => ({}));
      errors.push(`${file.name}: ${data?.error ?? 'não foi possível enviar.'}`);
    }
  }
  return errors;
}
const DONATION_PRESETS = [10, 20, 50, 100, 200];

export default function HospitalariaPortalPage() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [troncoBalance, setTroncoBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [donationAmount, setDonationAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [generatingDonation, setGeneratingDonation] = useState(false);
  const [donationResult, setDonationResult] = useState<{ pixCopyPaste: string | null; pixQrImage: string | null; invoiceUrl: string | null; lojaPix?: boolean; code?: string; amount?: number } | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [donationError, setDonationError] = useState<string | null>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadMine() {
    const res = await fetch('/api/hospitality-requests?mine=1');
    const data = await res.json().catch(() => ({}));
    setMine(data.items ?? []);
  }

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/campaigns');
      const data = await res.json().catch(() => ({}));
      setCampaigns(data.items ?? []);
      setTroncoBalance(data.tronco?.configured ? Number(data.tronco.balance) : null);
      setLoading(false);
      await loadMine();
    }
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newFiles.length > MAX_FILES) { setMessage({ kind: 'error', text: `Anexe no máximo ${MAX_FILES} documentos.` }); return; }
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/hospitality-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // Os documentos vão depois de criado o pedido; se algum falhar, ele já existe e dá para anexar de novo em "Meus pedidos".
      const errors = newFiles.length > 0 ? await uploadRequestFiles(data.item.id, newFiles) : [];
      setMessage(errors.length > 0
        ? { kind: 'error', text: `Pedido enviado, mas nem todos os documentos foram anexados — ${errors.join(' ')} Anexe de novo em "Meus pedidos".` }
        : { kind: 'ok', text: 'Pedido enviado à Hospitalaria com sucesso.' });
      setTitle('');
      setDescription('');
      setNewFiles([]);
      setShowForm(false);
      await loadMine();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao enviar o pedido.' });
    }
    setSaving(false);
  }

  function startEdit(r: MyRequest) {
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditDescription(r.description ?? '');
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setBusyId(editingId);
    const res = await fetch(`/api/hospitality-requests/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, description: editDescription }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (res.ok) { setEditingId(null); setMessage({ kind: 'ok', text: 'Pedido atualizado.' }); await loadMine(); }
    else setMessage({ kind: 'error', text: data.error ?? 'Erro ao salvar o pedido.' });
  }

  async function addFiles(requestId: string, files: File[]) {
    if (files.length === 0) return;
    setBusyId(requestId);
    const errors = await uploadRequestFiles(requestId, files);
    setBusyId(null);
    if (errors.length > 0) setMessage({ kind: 'error', text: errors.join(' ') });
    await loadMine();
  }

  async function removeFile(requestId: string, file: RequestFile) {
    if (!window.confirm(`Remover o documento "${file.name}"?`)) return;
    setBusyId(requestId);
    const res = await fetch(`/api/hospitality-requests/${requestId}/files/${file.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) setMessage({ kind: 'error', text: data.error ?? 'Erro ao remover o documento.' });
    await loadMine();
  }

  // Pix da chave da loja: o irmão avisa que pagou; a Tesouraria confere no extrato e lança no caixa.
  async function declareDonation() {
    if (!donationResult?.code || !donationResult.amount) return;
    setDeclaring(true);
    setDonationError(null);
    const res = await fetch('/api/hospitalaria/tronco/declare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: donationResult.code, amount: donationResult.amount }) });
    const data = await res.json().catch(() => ({}));
    setDeclaring(false);
    if (res.ok) setDeclared(true);
    else setDonationError(data.error ?? 'Não foi possível registrar o aviso.');
  }

  async function generateDonation() {
    const amount = donationAmount ?? Number(customAmount.replace(',', '.'));
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      setDonationError('Escolha um valor ou digite um valor válido.');
      return;
    }
    setGeneratingDonation(true);
    setDonationError(null);
    setDonationResult(null);
    const res = await fetch('/api/hospitalaria/tronco', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json().catch(() => ({}));
    setGeneratingDonation(false);
    if (res.ok) {
      setDeclared(false);
      setDonationResult({ pixCopyPaste: data.pixCopyPaste ?? null, pixQrImage: data.pixQrImage ?? null, invoiceUrl: data.invoiceUrl ?? null, lojaPix: Boolean(data.lojaPix), code: data.code, amount: data.amount });
    } else {
      setDonationError(data.error ?? 'Erro ao gerar a doação.');
    }
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Hospitalaria</h1>
            <p className="mt-1 text-sm text-sand-dark">Campanhas de benemerência ativas e pedidos de auxílio.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-sigma-blue-deep transition-all duration-200 ease-out hover:bg-gold-light"
          >
            {showForm ? 'Fechar' : 'Propor campanha / solicitar auxílio'}
          </button>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        {troncoBalance !== null ? (
          <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <p className="text-xs uppercase tracking-[0.15em] text-sand-dark">Saldo do Tronco de Solidariedade</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-gold">{brl(troncoBalance)}</p>
            <p className="mt-1 text-xs text-sand-dark">Valor disponível hoje para a benemerência da loja.</p>
          </section>
        ) : null}

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Doação para o Tronco de Solidariedade</h2>
          <p className="mt-1 text-sm text-sand-dark">
            Sua identidade como doador só é vista pelo Venerável Mestre e pelo Tesoureiro. Pagamento via Pix.
          </p>
          {donationError ? <Alert intent="danger" className="mt-3">{donationError}</Alert> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {DONATION_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => { setDonationAmount(v); setCustomAmount(''); setDonationResult(null); }}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  donationAmount === v ? 'border-gold bg-gold/10 text-gold' : 'border-white/15 text-sand hover:border-white/25'
                }`}
              >
                {brl(v)}
              </button>
            ))}
            <input
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setDonationAmount(null); setDonationResult(null); }}
              placeholder="Outro valor"
              aria-label="Outro valor da doação"
              inputMode="decimal"
              className={`${inputClass} w-32`}
            />
          </div>
          <Button type="button" onClick={generateDonation} disabled={generatingDonation} className="mt-4">
            {generatingDonation ? 'Gerando…' : 'Gerar doação'}
          </Button>
          {donationResult ? (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              <p>{donationResult.lojaPix ? 'Pix para a chave da loja gerado — pague no app do banco e depois toque em “Já doei”.' : 'Doação gerada — pague via Pix para confirmar.'}</p>
              {donationResult.invoiceUrl ? (
                <a href={donationResult.invoiceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex font-medium text-emerald-100 underline">
                  Abrir cobrança Pix
                </a>
              ) : null}
              {donationResult.pixQrImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- QR em data URL, gerado pelo Asaas
                <img src={donationResult.pixQrImage} alt="QR Code Pix da doação" width={176} height={176} className="mt-3 rounded-lg bg-white p-2" />
              ) : null}
              {donationResult.pixCopyPaste ? (
                <textarea readOnly value={donationResult.pixCopyPaste} onClick={(e) => e.currentTarget.select()} className={`${inputClass} mt-2 text-xs`} rows={3} />
              ) : null}
              {donationResult.lojaPix ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-emerald-100/80">Código da doação: <strong className="font-mono">{donationResult.code}</strong></p>
                  {declared ? (
                    <p className="font-medium text-emerald-100">Obrigado! Sua doação foi avisada e será confirmada pela Tesouraria.</p>
                  ) : (
                    <Button type="button" onClick={declareDonation} disabled={declaring}>{declaring ? 'Avisando…' : 'Já doei'}</Button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {showForm ? (
          <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Novo pedido</h2>
            <p className="mt-1 text-sm text-sand-dark">
              Envia uma mensagem direto para a Hospitalaria/Administração da loja — não é uma campanha formal ainda;
              quem decide formalizar é a própria Hospitalaria.
            </p>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Título (ex.: Auxílio para material escolar)" required />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="Descreva a situação e o que está sendo pedido" rows={4} />
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-sand-dark/70">Documentos do pedido (opcional)</span>
                <p className="text-xs text-sand-dark">Laudo, orçamento, ofício, fotos… ajudam a formalizar o pedido. PDF ou foto, até 4 MB cada, no máximo {MAX_FILES}.</p>
                <FilePicker ariaLabel="Documentos do pedido" accept={FILE_ACCEPT} multiple buttonLabel="Anexar documentos" emptyLabel="Nenhum documento anexado" fileNames={newFiles.map((x) => x.name)} onFiles={setNewFiles} />
              </div>
              <Button type="submit" disabled={saving}>{saving ? 'Enviando…' : 'Enviar pedido'}</Button>
            </form>
          </section>
        ) : null}

        {mine.length > 0 ? (
          <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Meus pedidos</h2>
            <p className="mt-1 text-sm text-sand-dark">Enquanto a Hospitalaria não analisar, você pode corrigir o texto e anexar ou remover documentos.</p>
            <div className="mt-4 space-y-3">
              {mine.map((r) => {
                const pending = r.status === 'pending';
                return (
                  <div key={r.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4 text-sm text-sand">
                    {editingId === r.id ? (
                      <form onSubmit={saveEdit} className="space-y-3">
                        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputClass} placeholder="Título" required />
                        <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className={inputClass} placeholder="Descreva a situação e o que está sendo pedido" rows={4} />
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={busyId === r.id}>{busyId === r.id ? 'Salvando…' : 'Salvar'}</Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-sand-light">{r.title}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pending ? 'bg-gold/10 text-gold' : 'bg-emerald-500/10 text-emerald-300'}`}>{pending ? 'Aguardando análise' : 'Analisado'}</span>
                        </div>
                        {r.description ? <p className="mt-1 text-sand-dark">{r.description}</p> : null}
                        <p className="mt-1 text-xs text-sand-dark/70">{new Date(r.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gold">Documentos ({r.files.length})</p>
                          {r.files.length > 0 ? (
                            <ul className="mt-1 divide-y divide-white/5">
                              {r.files.map((f) => (
                                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                                  <a href={`/api/hospitality-requests/${r.id}/files/${f.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words text-sand underline-offset-2 hover:text-gold hover:underline">{f.name} <span className="text-xs text-sand-dark">· {fileSize(f.size)}</span></a>
                                  {pending ? <button type="button" onClick={() => removeFile(r.id, f)} className="text-xs text-rose-300 hover:text-rose-200">Remover</button> : null}
                                </li>
                              ))}
                            </ul>
                          ) : <p className="mt-1 text-xs text-sand-dark">Nenhum documento anexado.</p>}
                          {pending && r.files.length < MAX_FILES ? (
                            <div className="mt-2">
                              <FilePicker ariaLabel={`Anexar documentos ao pedido ${r.title}`} accept={FILE_ACCEPT} multiple disabled={busyId === r.id} buttonLabel={busyId === r.id ? 'Enviando…' : 'Anexar documentos'} emptyLabel={`PDF ou foto, até 4 MB (máx. ${MAX_FILES})`} onFiles={(files) => addFiles(r.id, files)} />
                            </div>
                          ) : null}
                        </div>
                        {pending ? <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => startEdit(r)}>Editar pedido</Button> : null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Campanhas ativas</h2>
          {loading ? (
            <p className="mt-4 text-sm text-sand-dark">Carregando…</p>
          ) : campaigns.length === 0 ? (
            <p className="mt-4 text-sm text-sand-dark">Nenhuma campanha cadastrada no momento.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4 text-sm text-sand">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-sand-light">{c.title}</p>
                    <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">{STATUS_LABEL[c.status] ?? c.status}</span>
                  </div>
                  {c.description ? <p className="mt-1 text-sand-dark">{c.description}</p> : null}
                  {c.beneficiaryName ? <p className="mt-1 text-xs text-sand-dark">Beneficiário: {c.beneficiaryName}</p> : null}
                  {c.goalAmount ? (
                    <p className="mt-2 text-xs text-sand-dark">
                      Arrecadado: {brl(c.raised)} de {brl(c.goalAmount)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
