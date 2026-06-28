'use client';

import { useEffect, useState } from 'react';
import { Button, inputClass } from '@/components/ui';

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
  const INPUT = inputClass; // fonte única do design system

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-sand-light">Integrações</h1>
          <p className="mt-1 text-sm text-sand-dark">Cada loja conecta a própria conta — as chaves são salvas aqui, sem precisar de reimplantação do sistema.</p>
        </div>

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-sand-light">Asaas</h2>
              <p className="mt-2 text-sm text-sand-dark">Gateway de cobrança via boleto, Pix e cartão. O dinheiro cai direto na conta da sua loja.</p>
            </div>
            {status?.configured ? (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/12 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                Conectado • {status.env} • {status.maskedKey}
              </span>
            ) : (
              <span className="rounded-full border border-white/[10%] bg-white/[8%] px-2.5 py-0.5 text-xs font-medium text-sand-dark">Não conectado</span>
            )}
          </div>

          {message && (
            <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${message.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={save} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-sand-dark/70">Chave da API do Asaas</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={`mt-1.5 ${INPUT}`}
                placeholder={status?.configured ? 'Cole uma nova chave para substituir' : '$aact_...'}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-sand-dark/70">Ambiente</label>
              <select value={env} onChange={(e) => setEnv(e.target.value)} className={`mt-1.5 ${INPUT}`}>
                <option value="sandbox">Sandbox (testes)</option>
                <option value="production">Produção</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-sand-dark/70">Token do webhook (opcional, recomendado)</label>
              <input
                type="text"
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                className={`mt-1.5 ${INPUT}`}
                placeholder="defina o mesmo token no painel do Asaas"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Validando…' : status?.configured ? 'Atualizar chave' : 'Conectar Asaas'}
              </Button>
              {status?.configured && (
                <button type="button" onClick={disconnect} className="rounded-full border border-rose-500/40 px-5 py-2.5 text-sm font-medium text-rose-200 transition-all duration-200 ease-out hover:bg-rose-500/10 active:bg-rose-500/20">
                  Desconectar
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-3 text-xs text-sand-dark">
            <p className="font-medium text-sand">Webhook de baixa automática</p>
            <p className="mt-1">No painel do Asaas, cadastre esta URL para receber as confirmações de pagamento:</p>
            <code className="mt-2 block break-all text-gold">{webhookFullUrl}</code>
            <p className="mt-2">Use o mesmo token acima no campo de autenticação do webhook (header <code className="text-gold">asaas-access-token</code>).</p>
          </div>
        </section>

        <MessagingIntegration />

        <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Stripe</h2>
          <p className="mt-2 text-sm text-sand-dark">Assinatura da plataforma (a loja paga o SaaS). Gerenciado pela plataforma.</p>
          <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-300">
            Stripe ativo — modo teste
          </div>
        </section>
      </div>
    </main>
  );
}

interface MsgStatus {
  emailPlatform: boolean;
  whatsapp: { configured: boolean; phoneId: string | null; template: string | null; lang: string };
  sms: { configured: boolean; sid: string | null; from: string | null };
}

function MessagingIntegration() {
  const [st, setSt] = useState<MsgStatus | null>(null);
  const [wa, setWa] = useState({ phoneId: '', token: '', template: '', lang: 'pt_BR' });
  const [sms, setSms] = useState({ sid: '', token: '', from: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch('/api/integrations/messaging');
    if (res.ok) {
      const data = (await res.json()) as MsgStatus;
      setSt(data);
      setWa((w) => ({ ...w, phoneId: data.whatsapp.phoneId ?? '', template: data.whatsapp.template ?? '', lang: data.whatsapp.lang ?? 'pt_BR' }));
      setSms((s) => ({ ...s, sid: data.sms.sid ?? '', from: data.sms.from ?? '' }));
    }
  }
  useEffect(() => { load(); }, []);

  async function saveChannel(channel: 'whatsapp' | 'sms', payload: Record<string, string>) {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/integrations/messaging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, ...payload }) });
    const data = await res.json();
    setBusy(false);
    if (res.ok) { setMsg({ kind: 'ok', text: `${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} conectado.` }); await load(); }
    else setMsg({ kind: 'error', text: data.error ?? 'Erro ao salvar.' });
  }
  async function disconnect(channel: 'whatsapp' | 'sms') {
    if (!confirm(`Desconectar ${channel === 'whatsapp' ? 'o WhatsApp' : 'o SMS'} desta loja?`)) return;
    const res = await fetch(`/api/integrations/messaging?channel=${channel}`, { method: 'DELETE' });
    if (res.ok) { setMsg({ kind: 'ok', text: 'Canal desconectado.' }); await load(); }
  }

  const badge = (on: boolean, label: string) => (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${on ? 'border-emerald-500/20 bg-emerald-500/12 text-emerald-300' : 'border-white/[10%] bg-white/[8%] text-sand-dark'}`}>{label}</span>
  );

  return (
    <section className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-sand-light">Comunicação (WhatsApp / SMS)</h2>
          <p className="mt-2 text-sm text-sand-dark">Cada loja conecta a própria conta — o custo das mensagens é direto da loja. O e-mail é provido pela plataforma.</p>
        </div>
        {badge(Boolean(st?.emailPlatform), st?.emailPlatform ? 'E-mail ativo' : 'E-mail off')}
      </div>

      {msg && (
        <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${msg.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>{msg.text}</div>
      )}

      {/* WhatsApp */}
      <div className="mt-5 rounded-lg border border-white/[6%] bg-sigma-blue-deep/50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-sand-light">WhatsApp (Meta Cloud API)</p>
          {badge(Boolean(st?.whatsapp.configured), st?.whatsapp.configured ? 'Conectado' : 'Não conectado')}
        </div>
        <p className="mt-1 text-xs text-sand-dark">Mensagens proativas exigem um <strong>template aprovado</strong> pela Meta (corpo com 1 variável).</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input value={wa.phoneId} onChange={(e) => setWa({ ...wa, phoneId: e.target.value })} className={inputClass} placeholder="Phone Number ID" />
          <input type="password" value={wa.token} onChange={(e) => setWa({ ...wa, token: e.target.value })} className={inputClass} placeholder={st?.whatsapp.configured ? 'Novo token (substitui)' : 'Token (System User)'} />
          <input value={wa.template} onChange={(e) => setWa({ ...wa, template: e.target.value })} className={inputClass} placeholder="Nome do template (ex.: aviso_loja)" />
          <input value={wa.lang} onChange={(e) => setWa({ ...wa, lang: e.target.value })} className={inputClass} placeholder="Idioma do template (pt_BR)" />
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button type="button" size="sm" disabled={busy} onClick={() => saveChannel('whatsapp', wa)}>{st?.whatsapp.configured ? 'Atualizar' : 'Conectar WhatsApp'}</Button>
          {st?.whatsapp.configured && <button type="button" onClick={() => disconnect('whatsapp')} className="rounded-full border border-rose-500/40 px-4 py-1.5 text-xs font-medium text-rose-200 transition-all hover:bg-rose-500/10">Desconectar</button>}
        </div>
      </div>

      {/* SMS */}
      <div className="mt-4 rounded-lg border border-white/[6%] bg-sigma-blue-deep/50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-sand-light">SMS (Twilio)</p>
          {badge(Boolean(st?.sms.configured), st?.sms.configured ? 'Conectado' : 'Não conectado')}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input value={sms.sid} onChange={(e) => setSms({ ...sms, sid: e.target.value })} className={inputClass} placeholder="Account SID" />
          <input type="password" value={sms.token} onChange={(e) => setSms({ ...sms, token: e.target.value })} className={inputClass} placeholder={st?.sms.configured ? 'Novo Auth Token (substitui)' : 'Auth Token'} />
          <input value={sms.from} onChange={(e) => setSms({ ...sms, from: e.target.value })} className={`${inputClass} md:col-span-2`} placeholder="Número remetente (ex.: +5521...)" />
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button type="button" size="sm" disabled={busy} onClick={() => saveChannel('sms', sms)}>{st?.sms.configured ? 'Atualizar' : 'Conectar SMS'}</Button>
          {st?.sms.configured && <button type="button" onClick={() => disconnect('sms')} className="rounded-full border border-rose-500/40 px-4 py-1.5 text-xs font-medium text-rose-200 transition-all hover:bg-rose-500/10">Desconectar</button>}
        </div>
      </div>
    </section>
  );
}
