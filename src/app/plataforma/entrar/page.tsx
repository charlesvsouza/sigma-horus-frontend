'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, CardDescription, CardTitle, Input, inputClass } from '@/components/ui';

// Login do dono da plataforma como o admin de qualquer loja ativa — mesmo
// PLATFORM_OWNER_TOKEN de /plataforma/convites e /plataforma/backups, mas em
// vez de um painel próprio, autentica de verdade (NextAuth) e abre o
// dashboard normal da loja escolhida. Ver provider "platform-impersonate" em
// api/auth/[...nextauth]/auth.ts (registra em AuditLog quem/quando entrou).
const TOKEN_KEY = 'sigma-platform-token';

interface LodgeOption {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
}

export default function EntrarSuperadminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [checking, setChecking] = useState(true);

  const [lodges, setLodges] = useState<LodgeOption[]>([]);
  const [loadingLodges, setLoadingLodges] = useState(false);
  const [listError, setListError] = useState('');

  const [lodgeId, setLodgeId] = useState('');
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState('');

  async function loadLodges(t: string): Promise<boolean> {
    setLoadingLodges(true);
    setListError('');
    try {
      const res = await fetch('/api/plataforma/lodges', { headers: { 'x-platform-token': t } });
      if (res.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setTokenError('Token inválido ou expirado. Informe novamente.');
        return false;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListError(data.error ?? 'Não foi possível carregar as lojas.');
        return false;
      }
      setLodges(data.lodges ?? []);
      return true;
    } catch {
      setListError('Não foi possível conectar ao servidor. Tente novamente.');
      return false;
    } finally {
      setLoadingLodges(false);
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (!saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecking(false);
      return;
    }
    (async () => {
      const ok = await loadLodges(saved);
      if (ok) setToken(saved);
      setChecking(false);
    })();
  }, []);

  async function handleTokenSubmit(event: FormEvent) {
    event.preventDefault();
    setTokenError('');
    const t = tokenInput.trim();
    if (!t) return;
    const ok = await loadLodges(t);
    if (ok) {
      sessionStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setTokenInput('');
    }
  }

  async function handleEnter(event: FormEvent) {
    event.preventDefault();
    if (!token || !lodgeId) return;
    setEntering(true);
    setEnterError('');

    const result = await signIn('platform-impersonate', {
      redirect: false,
      platformToken: token,
      lodgeId,
    });

    setEntering(false);

    if (result?.error) {
      setEnterError('Não foi possível entrar nessa loja (token inválido ou a loja não tem admin ativo).');
      return;
    }

    window.location.href = '/dashboard';
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
          <h1 className="mt-3 text-xl font-semibold text-sand-light">Entrar como superadmin</h1>
          <p className="mt-2 text-sm text-sand-dark">
            Informe o token do dono da plataforma para escolher uma loja.
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
            <Button type="submit" className="w-full">Continuar</Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sigma-blue-deep px-6">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-between text-sm">
          <Link href="/plataforma" className="text-gold-light hover:text-gold">← Plataforma</Link>
          <button
            type="button"
            onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setToken(null); setLodges([]); }}
            className="text-sand-dark hover:text-sand"
          >
            Sair
          </button>
        </div>

        <Card>
          <CardTitle>Entrar como superadmin</CardTitle>
          <CardDescription>
            Você vai entrar com a conta do admin da loja escolhida. Isso fica registrado no
            log de auditoria da loja.
          </CardDescription>

          {listError ? <Alert intent="danger" className="mt-4">{listError}</Alert> : null}

          <form onSubmit={handleEnter} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-sand-light">Loja</label>
              <select
                value={lodgeId}
                onChange={(e) => setLodgeId(e.target.value)}
                className={inputClass}
                required
                disabled={loadingLodges}
              >
                <option value="">{loadingLodges ? 'Carregando…' : 'Selecione uma loja'}</option>
                {lodges.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.city ? ` — ${l.city}${l.state ? '/' + l.state : ''}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {enterError ? <Alert intent="danger">{enterError}</Alert> : null}

            <Button type="submit" className="w-full" disabled={entering || !lodgeId}>
              {entering ? 'Entrando…' : 'Entrar nesta loja'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
