'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import { hardNavigate } from '@/lib/hard-navigate';

// Visão global das lojas (dono da plataforma). Mesmo token de /plataforma/entrar (guardado na sessão do navegador).
const TOKEN_KEY = 'sigma-platform-token';

interface Row {
  id: string;
  name: string;
  slug: string;
  status: string;
  city: string | null;
  state: string | null;
  acquisitionSource: string | null;
  createdAt: string;
  plan: string | null;
  subStatus: string | null;
  billingInterval: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysToTrialEnd: number | null;
  blocked: boolean;
  members: number;
  users: number;
}

const SUB_LABEL: Record<string, string> = {
  trialing: 'Em teste',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
  inactive: 'Inativa',
  canceled: 'Cancelada',
};
const PLAN_LABEL: Record<string, string> = { oficina: 'Oficina', loja: 'Loja', potencia: 'Potência' };
type Filter = 'all' | 'blocked' | 'trialing' | 'active';

const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat('pt-BR').format(new Date(iso)) : '—');

export default function LojasPlataformaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [enteringId, setEnteringId] = useState<string | null>(null);

  const load = useCallback(async (t: string): Promise<boolean> => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/plataforma/overview', { headers: { 'x-platform-token': t } });
      if (res.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setError('Token inválido ou expirado. Informe novamente.');
        return false;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Não foi possível carregar as lojas.');
        return false;
      }
      setRows(data.lodges ?? []);
      return true;
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (!saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecking(false);
      return;
    }
    (async () => {
      if (await load(saved)) setToken(saved);
      setChecking(false);
    })();
  }, [load]);

  async function submitToken(event: FormEvent) {
    event.preventDefault();
    const t = tokenInput.trim();
    if (!t) return;
    if (await load(t)) {
      sessionStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setTokenInput('');
    }
  }

  async function enter(lodgeId: string) {
    if (!token) return;
    setEnteringId(lodgeId);
    setError('');
    const result = await signIn('platform-impersonate', { redirect: false, platformToken: token, lodgeId });
    setEnteringId(null);
    if (result?.error) {
      setError('Não foi possível entrar nessa loja (token inválido ou a loja não tem usuário ativo).');
      return;
    }
    hardNavigate('/dashboard');
  }

  const counts = useMemo(
    () => ({
      all: rows.length,
      blocked: rows.filter((r) => r.blocked).length,
      trialing: rows.filter((r) => r.subStatus === 'trialing' && !r.blocked).length,
      active: rows.filter((r) => r.subStatus === 'active').length,
    }),
    [rows],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'blocked' && !r.blocked) return false;
      if (filter === 'trialing' && !(r.subStatus === 'trialing' && !r.blocked)) return false;
      if (filter === 'active' && r.subStatus !== 'active') return false;
      return !q || `${r.name} ${r.slug} ${r.city ?? ''}`.toLowerCase().includes(q);
    });
  }, [rows, filter, query]);

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
        <div className="w-full max-w-sm rounded-2xl border border-white/8 bg-sigma-blue-dark/80 p-8">
          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gold/60">Sigma Horus — Plataforma</p>
          <h1 className="mt-3 text-xl font-semibold text-sand-light">Todas as lojas</h1>
          <p className="mt-2 text-sm text-sand-dark">Informe o token do dono da plataforma.</p>
          <form onSubmit={submitToken} className="mt-6 space-y-4">
            <Input label="Token da plataforma" type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} error={error} autoFocus />
            <Button type="submit" className="w-full">Continuar</Button>
          </form>
        </div>
      </main>
    );
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `Todas (${counts.all})` },
    { key: 'blocked', label: `Sem assinatura vigente (${counts.blocked})` },
    { key: 'trialing', label: `Em teste (${counts.trialing})` },
    { key: 'active', label: `Assinantes (${counts.active})` },
  ];

  return (
    <main className="min-h-screen bg-sigma-blue-deep px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between text-sm">
          <Link href="/plataforma" className="text-gold-light hover:text-gold">← Plataforma</Link>
          <button type="button" onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setToken(null); setRows([]); }} className="text-sand-dark hover:text-sand">
            Sair
          </button>
        </div>
        <h1 className="text-2xl font-bold text-sand-light">Todas as lojas</h1>
        <p className="mt-1 text-sm text-sand-dark">
          Entrar numa loja abre o painel dela com a conta do administrador e fica registrado na auditoria da loja.
        </p>

        {error ? <Alert intent="danger" className="mt-4">{error}</Alert> : null}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs ${filter === f.key ? 'border-gold bg-gold/15 text-gold-light' : 'border-white/10 text-sand-dark hover:text-sand'}`}
            >
              {f.label}
            </button>
          ))}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou cidade"
            className="ml-auto w-full rounded-lg border border-white/10 bg-sigma-blue-dark/60 px-3 py-1.5 text-sm text-sand-light sm:w-64"
          />
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/8 bg-sigma-blue-dark/50">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-sand-dark">
              <tr>
                <th className="px-4 py-3">Loja</th>
                <th className="px-4 py-3">Assinatura</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Teste / renovação</th>
                <th className="px-4 py-3 text-right">Membros</th>
                <th className="px-4 py-3 text-right">Usuários</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-sand-dark">Carregando…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-sand-dark">Nenhuma loja neste filtro.</td></tr>
              ) : (
                shown.map((r) => (
                  <tr key={r.id} className="border-t border-white/6 text-sand-light">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-sand-dark">
                        {r.city ? `${r.city}${r.state ? '/' + r.state : ''} · ` : ''}criada em {fmt(r.createdAt)}
                        {r.status !== 'active' ? ` · loja ${r.status}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={r.blocked ? 'text-rose-300' : 'text-emerald-300'}>
                        {r.subStatus ? SUB_LABEL[r.subStatus] ?? r.subStatus : 'Sem assinatura'}
                      </span>
                      {r.blocked ? <p className="text-xs text-rose-300/80">bloqueada</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      {r.plan ? PLAN_LABEL[r.plan] ?? r.plan : '—'}
                      {r.billingInterval === 'year' ? <span className="text-xs text-sand-dark"> · anual</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      {r.subStatus === 'trialing' && r.trialEndsAt ? (
                        <>
                          {fmt(r.trialEndsAt)}
                          <p className="text-xs text-sand-dark">
                            {r.daysToTrialEnd !== null && r.daysToTrialEnd > 0
                              ? `faltam ${r.daysToTrialEnd} ${r.daysToTrialEnd === 1 ? 'dia' : 'dias'}`
                              : 'teste vencido'}
                          </p>
                        </>
                      ) : (
                        fmt(r.currentPeriodEnd)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.members}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.users}</td>
                    <td className="px-4 py-3 text-xs text-sand-dark">{r.acquisitionSource ?? 'sem link'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" onClick={() => enter(r.id)} disabled={enteringId !== null}>
                        {enteringId === r.id ? 'Entrando…' : 'Entrar'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
