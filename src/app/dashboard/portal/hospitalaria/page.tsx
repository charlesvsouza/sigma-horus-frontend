'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, inputClass } from '@/components/ui';
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

const STATUS_LABEL: Record<string, string> = { active: 'Ativa', completed: 'Concluída', canceled: 'Cancelada' };
const DONATION_PRESETS = [5, 10, 20, 50, 100];

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
  const [donationResult, setDonationResult] = useState<{ pixCopyPaste: string | null; invoiceUrl: string | null } | null>(null);
  const [donationError, setDonationError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data.items ?? []);
      setTroncoBalance(data.tronco?.configured ? Number(data.tronco.balance) : null);
      setLoading(false);
    }
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/hospitality-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Pedido enviado à Hospitalaria com sucesso.' });
      setTitle('');
      setDescription('');
      setShowForm(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao enviar o pedido.' });
    }
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
      setDonationResult({ pixCopyPaste: data.pixCopyPaste ?? null, invoiceUrl: data.invoiceUrl ?? null });
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

        {message ? <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert> : null}

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
              <p>Doação gerada — pague via Pix para confirmar.</p>
              {donationResult.invoiceUrl ? (
                <a href={donationResult.invoiceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex font-medium text-emerald-100 underline">
                  Abrir cobrança Pix
                </a>
              ) : null}
              {donationResult.pixCopyPaste ? (
                <textarea readOnly value={donationResult.pixCopyPaste} onClick={(e) => e.currentTarget.select()} className={`${inputClass} mt-2 text-xs`} rows={3} />
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
              <Button type="submit" disabled={saving}>{saving ? 'Enviando…' : 'Enviar pedido'}</Button>
            </form>
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
