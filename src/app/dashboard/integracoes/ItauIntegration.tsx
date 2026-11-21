'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, inputClass } from '@/components/ui';

/**
 * Cobrança pelo banco (Itaú) — tela de credenciais.
 *
 * A loja cola client_id, client_secret, o certificado (.crt/PEM) e a chave privada (.key/PEM).
 * Ao salvar, o servidor confere o par certificado/chave, testa o token no Itaú e grava active/error.
 * Enquanto não estiver ativa, a emissão continua pelo Asaas (ou fica bloqueada, se não houver Asaas) —
 * nenhuma cobrança quebra por falta de credencial.
 */

interface Banco {
  id: string;
  label: string;
  auth: string;
  temBoleto: boolean;
}

interface Estado {
  provider: { id: string | null; label: string; ready: boolean; reason: string | null };
  bancos: Banco[];
  integration: {
    env: string; status: string; clientHint: string | null; pixKey: string | null;
    certNotAfter: string | null; certHealth: 'ok' | 'renew' | 'expired' | null;
    lastCheckAt: string | null; lastError: string | null; hasCredentials: boolean;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando credenciais',
  active: 'Conectada',
  error: 'Com erro',
  disabled: 'Desligada',
};

export default function ItauIntegration() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    provider: 'itau', env: 'production', clientId: '', clientSecret: '', certificatePem: '', privateKeyPem: '', pixKey: '',
  });

  async function carregar() {
    const res = await fetch('/api/bank-integration', { cache: 'no-store' });
    if (res.ok) setEstado(await res.json());
  }
  // Carga inicial única do estado da integração (o efeito roda uma vez, no mount).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, []);

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const res = await fetch('/api/bank-integration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok || data.ok === false) {
      setMsg({ kind: 'error', text: data.error ?? 'Não foi possível salvar as credenciais.' });
      await carregar();
      return;
    }
    setMsg({ kind: 'ok', text: 'Credenciais salvas e validadas no Itaú. As próximas cobranças já saem pelo banco.' });
    setAberto(false);
    setForm((f) => ({ ...f, clientSecret: '', certificatePem: '', privateKeyPem: '' }));
    await carregar();
    router.refresh();
  }

  async function desligar() {
    setSalvando(true);
    const res = await fetch('/api/bank-integration', { method: 'DELETE' });
    setSalvando(false);
    if (res.ok) {
      setMsg({ kind: 'ok', text: 'Integração desligada. A loja volta a emitir pelo Asaas, se estiver conectado.' });
      await carregar();
      router.refresh();
    }
  }

  const integ = estado?.integration ?? null;
  const status = integ?.status ?? 'pending';
  const bancos = estado?.bancos ?? [];
  const bancoAtual = bancos.find((b) => b.id === form.provider) ?? bancos[0] ?? null;

  return (
    <section className="mt-4 rounded-xl border border-white/6 bg-sigma-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-sand-light">Cobrança pelo banco{bancoAtual ? ` (${bancoAtual.label})` : ''}</h2>
          <p className="mt-1 text-sm text-sand-dark">
            Pix e boleto emitidos pelo próprio banco: o dinheiro cai direto na conta da loja, sem intermediário.
            Precisa do credenciamento da conta no banco (client_id, client_secret e certificado).
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : status === 'error' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {integ ? (
        <dl className="mt-4 grid gap-2 text-sm text-sand-dark sm:grid-cols-2">
          <div><dt className="text-xs uppercase tracking-wide text-sand-dark/70">Ambiente</dt><dd>{integ.env === 'sandbox' ? 'Homologação' : 'Produção'}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-sand-dark/70">client_id</dt><dd>{integ.clientHint ?? '—'}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-sand-dark/70">Chave Pix</dt><dd>{integ.pixKey ?? 'não informada'}</dd></div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-sand-dark/70">Certificado</dt>
            <dd>
              {integ.certNotAfter ? new Date(integ.certNotAfter).toLocaleDateString('pt-BR') : '—'}
              {integ.certHealth === 'renew' ? <span className="ml-2 text-amber-300">renovar em breve</span> : null}
              {integ.certHealth === 'expired' ? <span className="ml-2 text-red-300">vencido</span> : null}
            </dd>
          </div>
        </dl>
      ) : null}

      {estado?.provider.reason ? <Alert intent="warn" className="mt-4">{estado.provider.reason}</Alert> : null}
      {integ?.lastError ? <Alert intent="danger" className="mt-3">{integ.lastError}</Alert> : null}
      {msg ? <Alert intent={msg.kind === 'ok' ? 'ok' : 'danger'} className="mt-3">{msg.text}</Alert> : null}

      {aberto ? (
        <div className="mt-5 grid gap-4">
          {bancos.length > 1 ? (
            <label className="block text-sm text-sand-dark">
              Banco
              <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className={`mt-1.5 ${inputClass}`}>
                {bancos.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </label>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-sand-dark">
              Ambiente
              <select value={form.env} onChange={(e) => setForm({ ...form, env: e.target.value })} className={`mt-1.5 ${inputClass}`}>
                <option value="production">Produção</option>
                <option value="sandbox">Homologação (sandbox)</option>
              </select>
            </label>
            <label className="block text-sm text-sand-dark">
              Chave Pix da loja (recebe as cobranças)
              <input value={form.pixKey} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} className={`mt-1.5 ${inputClass}`} placeholder="chave@loja.com.br" />
            </label>
            <label className="block text-sm text-sand-dark">
              client_id
              <input value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={`mt-1.5 ${inputClass}`} autoComplete="off" />
            </label>
            <label className="block text-sm text-sand-dark">
              client_secret
              <input type="password" value={form.clientSecret} onChange={(e) => setForm({ ...form, clientSecret: e.target.value })} className={`mt-1.5 ${inputClass}`} autoComplete="new-password" />
            </label>
          </div>
          <label className="block text-sm text-sand-dark">
            Certificado (.crt ou PEM) — cole o conteúdo inteiro, com as linhas BEGIN/END
            <textarea value={form.certificatePem} onChange={(e) => setForm({ ...form, certificatePem: e.target.value })} rows={5} className={`mt-1.5 ${inputClass} font-mono text-xs`} placeholder="-----BEGIN CERTIFICATE-----" />
          </label>
          <label className="block text-sm text-sand-dark">
            Chave privada (.key ou PEM) — do mesmo credenciamento
            <textarea value={form.privateKeyPem} onChange={(e) => setForm({ ...form, privateKeyPem: e.target.value })} rows={5} className={`mt-1.5 ${inputClass} font-mono text-xs`} placeholder="-----BEGIN PRIVATE KEY-----" />
          </label>
          <p className="text-xs text-sand-dark">
            Ao salvar, o sistema confere se a chave é do certificado e testa a autenticação no Itaú. Se o banco recusar,
            as credenciais ficam salvas como <strong>com erro</strong> e a emissão continua pelo Asaas.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={salvar} disabled={salvando}>{salvando ? 'Validando…' : 'Salvar e validar'}</Button>
            <Button type="button" variant="secondary" onClick={() => setAberto(false)} disabled={salvando}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setAberto(true)}>{integ ? 'Trocar credenciais' : 'Inserir credenciais'}</Button>
          {integ && integ.status !== 'disabled' ? (
            <Button type="button" variant="secondary" onClick={desligar} disabled={salvando}>Desligar integração</Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
