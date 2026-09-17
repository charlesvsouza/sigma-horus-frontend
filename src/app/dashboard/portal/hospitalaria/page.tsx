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

export default function HospitalariaPortalPage() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data.items ?? []);
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
                    <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold">{STATUS_LABEL[c.status] ?? c.status}</span>
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
