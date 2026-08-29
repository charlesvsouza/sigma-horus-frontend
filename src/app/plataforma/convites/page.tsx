'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, type BadgeVariant, Button, Card, CardDescription, CardTitle, EmptyState, Input, inputClass } from '@/components/ui';
import { PLANS, TRIAL_DAYS, TRIAL_PLAN, type PlanId } from '@/lib/plans';

// Painel do dono da plataforma (não é multi-tenant): gera e lista convites de
// acesso (cadastro de teste somente por convite). Autenticação por token
// compartilhado (PLATFORM_OWNER_TOKEN), guardado só em sessionStorage —
// some ao fechar a aba.
const TOKEN_KEY = 'sigma-platform-token';

interface InviteRow {
  id: string;
  code: string;
  email: string | null;
  note: string | null;
  status: string;
  plan: string | null;
  trialDays: number | null;
  expiresAt: string;
  createdAt: string;
}

interface CreatedInvite {
  code: string;
  link: string;
  expiresAt: string;
  plan: string | null;
  trialDays: number | null;
}

const STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  pending: { variant: 'pending', label: 'Pendente' },
  used: { variant: 'success', label: 'Usado' },
  revoked: { variant: 'canceled', label: 'Revogado' },
  expired: { variant: 'error', label: 'Expirado' },
};

const EMPTY_FORM = { email: '', note: '', plan: '' as '' | PlanId, trialDays: '', ttlDays: '' };

function fmtDate(v: string) {
  return new Date(v).toLocaleString('pt-BR');
}

function planLabel(plan: string | null) {
  if (!plan) return `${PLANS[TRIAL_PLAN].name} (padrão)`;
  return PLANS[plan as PlanId]?.name ?? plan;
}

export default function ConvitesPlataformaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [checking, setChecking] = useState(true);

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copiedLink, setCopiedLink] = useState('');

  async function loadInvites(t: string): Promise<boolean> {
    setLoadingList(true);
    setListError('');
    const res = await fetch('/api/invites', { headers: { 'x-platform-token': t } });
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setTokenError('Token inválido ou expirado. Informe novamente.');
      setLoadingList(false);
      return false;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setListError(data.error ?? 'Não foi possível carregar os convites.');
      setLoadingList(false);
      return false;
    }
    setInvites(data.invites ?? []);
    setLoadingList(false);
    return true;
  }

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (!saved) {
      // Init a partir do sessionStorage (dispensa Suspense); não é fetch-on-mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecking(false);
      return;
    }
    (async () => {
      const ok = await loadInvites(saved);
      if (ok) setToken(saved);
      setChecking(false);
    })();
  }, []);

  async function handleTokenSubmit(event: FormEvent) {
    event.preventDefault();
    setTokenError('');
    const t = tokenInput.trim();
    if (!t) return;
    const ok = await loadInvites(t);
    if (ok) {
      sessionStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setTokenInput('');
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setInvites([]);
    setCreated(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setCreating(true);
    setCreateError('');
    setCreated(null);

    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-platform-token': token },
      body: JSON.stringify({
        email: form.email.trim() || undefined,
        note: form.note.trim() || undefined,
        plan: form.plan || undefined,
        trialDays: form.trialDays ? Number(form.trialDays) : undefined,
        ttlDays: form.ttlDays ? Number(form.ttlDays) : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setCreating(false);

    if (res.status === 401) {
      handleLogout();
      setTokenError('Sessão expirada. Informe o token novamente.');
      return;
    }
    if (!res.ok) {
      setCreateError(data.error ?? 'Não foi possível gerar o convite.');
      return;
    }

    setCreated(data);
    setForm(EMPTY_FORM);
    loadInvites(token);
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(link);
      setTimeout(() => setCopiedLink(''), 2000);
    } catch {
      // clipboard indisponível (ex.: contexto não seguro) — sem ação
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sigma-blue-deep">
        <p className="text-sm text-sand-dark">Carregando…</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sigma-blue-deep px-6">
        <div className="w-full max-w-sm rounded-2xl border border-white/[8%] bg-sigma-blue-dark/80 p-8">
          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gold/60">Sigma Horus — Plataforma</p>
          <h1 className="mt-3 text-xl font-semibold text-sand-light">Acesso restrito</h1>
          <p className="mt-2 text-sm text-sand-dark">
            Informe o token do dono da plataforma para gerar e visualizar convites de teste.
          </p>
          <form onSubmit={handleTokenSubmit} className="mt-6 space-y-4">
            <Input
              label="Token da plataforma"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="••••••••••••"
              error={tokenError}
              autoFocus
            />
            <Button type="submit" className="w-full">Entrar</Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sigma-blue-deep px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gold/60">Sigma Horus — Plataforma</p>
            <h1 className="mt-2 text-2xl font-bold text-sand-light">Convites de acesso</h1>
            <p className="mt-1 text-sm text-sand-dark">
              O cadastro de teste é somente por convite. Sem overrides, o convite libera{' '}
              {TRIAL_DAYS} dias no plano {PLANS[TRIAL_PLAN].name}.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>Sair</Button>
        </div>

        <Card>
          <CardTitle>Novo convite</CardTitle>
          <CardDescription>
            Deixe plano e dias de teste em branco para usar o padrão. Para um teste estendido no
            plano Loja, por exemplo, escolha &quot;Loja&quot; e informe 60 dias.
          </CardDescription>
          <form onSubmit={handleCreate} className="mt-5 grid gap-4 md:grid-cols-2">
            <Input
              label="E-mail (opcional)"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="pessoa@exemplo.com"
            />
            <Input
              label="Nota interna (opcional)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Ex: Loja Estrela do Oriente — indicação"
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-sand" htmlFor="invite-plan">Plano do trial</label>
              <select
                id="invite-plan"
                value={form.plan}
                onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value as '' | PlanId }))}
                className={inputClass}
              >
                <option value="">Padrão ({PLANS[TRIAL_PLAN].name})</option>
                {Object.values(PLANS).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <Input
              label="Dias de teste (opcional)"
              type="number"
              min={1}
              value={form.trialDays}
              onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value }))}
              placeholder={`Padrão: ${TRIAL_DAYS}`}
            />
            <Input
              label="Validade do link em dias (opcional)"
              type="number"
              min={1}
              value={form.ttlDays}
              onChange={(e) => setForm((f) => ({ ...f, ttlDays: e.target.value }))}
              placeholder="Padrão: 14"
            />

            {createError ? <Alert intent="danger" className="md:col-span-2">{createError}</Alert> : null}

            <div className="md:col-span-2">
              <Button type="submit" disabled={creating}>
                {creating ? 'Gerando…' : 'Gerar convite'}
              </Button>
            </div>
          </form>

          {created ? (
            <Alert intent="ok" className="mt-5 space-y-2">
              <p className="font-medium">Convite {created.code} gerado.</p>
              <p className="break-all text-xs">{created.link}</p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button size="sm" variant="secondary" type="button" onClick={() => copyLink(created.link)}>
                  {copiedLink === created.link ? 'Copiado!' : 'Copiar link'}
                </Button>
                <span className="text-xs">
                  {planLabel(created.plan)} · {created.trialDays ?? TRIAL_DAYS} dias de teste · expira em {fmtDate(created.expiresAt)}
                </span>
              </div>
            </Alert>
          ) : null}
        </Card>

        <div>
          <h2 className="text-base font-semibold text-sand-light">Convites gerados</h2>

          {listError ? <Alert intent="danger" className="mt-3">{listError}</Alert> : null}

          {loadingList ? (
            <p className="mt-4 text-sm text-sand-dark">Carregando…</p>
          ) : invites.length === 0 ? (
            <EmptyState
              title="Nenhum convite ainda"
              description="Gere o primeiro convite no formulário acima."
            />
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/[6%]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/[6%] bg-sigma-card">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Código</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">E-mail</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Nota</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Plano</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Dias</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Expira em</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-sand-dark">Criado em</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv) => {
                    const badge = STATUS_BADGE[inv.status] ?? { variant: 'info' as BadgeVariant, label: inv.status };
                    const link = `${window.location.origin}/onboarding?invite=${inv.code}`;
                    return (
                      <tr key={inv.id} className="border-b border-white/[5%] transition-colors hover:bg-white/[3%]">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-sand-light">{inv.code}</td>
                        <td className="px-4 py-3 text-sand-dark">{inv.email ?? '—'}</td>
                        <td className="max-w-[14rem] truncate px-4 py-3 text-sand-dark">{inv.note ?? '—'}</td>
                        <td className="px-4 py-3 text-sand">{planLabel(inv.plan)}</td>
                        <td className="px-4 py-3 text-sand-dark">{inv.trialDays ?? TRIAL_DAYS}</td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sand-dark">{fmtDate(inv.expiresAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sand-dark">{fmtDate(inv.createdAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {inv.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => copyLink(link)}
                              className="text-xs font-medium text-gold-light hover:text-gold"
                            >
                              {copiedLink === link ? 'Copiado!' : 'Copiar link'}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
