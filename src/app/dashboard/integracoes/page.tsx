'use client';

import { useEffect, useState } from 'react';

interface AsaasStatus {
  configured: boolean;
  env: string;
  maskedKey: string | null;
  hasWebhookToken: boolean;
  webhookUrl: string;
}

export default function IntegracoesPage() {
  const [status, setStatus] = useState<AsaasStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [env, setEnv] = useState('sandbox');
  const [webhookToken, setWebhookToken] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadStatus() {
    const res = await fetch('/api/integrations/asaas');
    if (res.ok) {
      const data = (await res.json()) as AsaasStatus;
      setStatus(data);
      setEnv(data.env ?? 'sandbox');
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) {
      setMessage({ kind: 'error', text: 'Informe a chave da API do Asaas.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/integrations/asaas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.trim(), env, webhookToken: webhookToken.trim() }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Asaas conectado para esta loja.' });
      setApiKey('');
      setWebhookToken('');
      await loadStatus();
    } else {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao salvar.' });
    }
  }

  async function disconnect() {
    if (!confirm('Desconectar o Asaas desta loja?')) return;
    const res = await fetch('/api/integrations/asaas', { method: 'DELETE' });
    if (res.ok) {
      setMessage({ kind: 'ok', text: 'Asaas desconectado.' });
      await loadStatus();
    }
  }

  const webhookFullUrl = typeof window !== 'undefined' && status ? `${window.location.origin}${status.webhookUrl}` : status?.webhookUrl;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Integrações</h1>
          <p className="mt-3 text-slate-400">Cada loja conecta a própria conta — as chaves são salvas aqui, sem precisar de reimplantação do sistema.</p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Asaas</h2>
              <p className="mt-2 text-sm text-slate-400">Gateway de cobrança via boleto, Pix e cartão. O dinheiro cai direto na conta da sua loja.</p>
            </div>
            {status?.configured ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                Conectado • {status.env} • {status.maskedKey}
              </span>
            ) : (
              <span className="rounded-full border border-slate-600 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">Não conectado</span>
            )}
          </div>

          {message && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${message.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={save} className="mt-6 space-y-4">
            <div>
              <label className="text-sm text-slate-400">Chave da API do Asaas</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3"
                placeholder={status?.configured ? 'Cole uma nova chave para substituir' : '$aact_...'}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">Ambiente</label>
              <select value={env} onChange={(e) => setEnv(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                <option value="sandbox">Sandbox (testes)</option>
                <option value="production">Produção</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400">Token do webhook (opcional, recomendado)</label>
              <input
                type="text"
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3"
                placeholder="defina o mesmo token no painel do Asaas"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={saving} className="rounded-full bg-amber-400 px-5 py-3 font-medium text-slate-950 disabled:opacity-60">
                {saving ? 'Validando…' : status?.configured ? 'Atualizar chave' : 'Conectar Asaas'}
              </button>
              {status?.configured && (
                <button type="button" onClick={disconnect} className="rounded-full border border-rose-500/40 px-5 py-3 font-medium text-rose-200">
                  Desconectar
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
            <p className="font-medium text-slate-300">Webhook de baixa automática</p>
            <p className="mt-1">No painel do Asaas, cadastre esta URL para receber as confirmações de pagamento:</p>
            <code className="mt-2 block break-all text-amber-300">{webhookFullUrl}</code>
            <p className="mt-2">Use o mesmo token acima no campo de autenticação do webhook (header <code className="text-amber-300">asaas-access-token</code>).</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Stripe</h2>
          <p className="mt-2 text-sm text-slate-400">Assinatura da plataforma (a loja paga o SaaS). Gerenciado pela plataforma.</p>
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Stripe ativo — modo teste
          </div>
        </section>
      </div>
    </main>
  );
}
