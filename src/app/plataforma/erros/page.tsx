'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, CardDescription, CardTitle, EmptyState, Input } from '@/components/ui';

// Painel do dono (não é multi-tenant): erros em produção agrupados por tipo, com contagem. Mesmo token
// de /plataforma/backups (sessionStorage — some ao fechar a aba).
const TOKEN_KEY = 'sigma-platform-token';

interface ErrorRow {
  id: string;
  source: string;
  route: string;
  method: string | null;
  message: string;
  stack: string | null;
  digest: string | null;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

const fmt = (v: string) => new Date(v).toLocaleString('pt-BR');

export default function ErrosPlataformaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [checking, setChecking] = useState(true);
  const [items, setItems] = useState<ErrorRow[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  async function load(t: string): Promise<boolean> {
    setError('');
    const res = await fetch('/api/platform/errors', { headers: { 'x-platform-token': t } }).catch(() => null);
    if (!res) { setError('Não foi possível conectar ao servidor.'); return false; }
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setTokenError('Token inválido ou expirado. Informe novamente.');
      return false;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? 'Não foi possível carregar os erros.'); return false; }
    setItems(data.items ?? []);
    return true;
  }

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
  }, []);

  async function submitToken(e: FormEvent) {
    e.preventDefault();
    setTokenError('');
    const t = tokenInput.trim();
    if (!t) return;
    if (await load(t)) {
      sessionStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setTokenInput('');
    }
  }

  async function toggle(row: ErrorRow) {
    if (!token) return;
    await fetch('/api/platform/errors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-platform-token': token },
      body: JSON.stringify({ id: row.id, resolved: !row.resolvedAt }),
    }).catch(() => null);
    await load(token);
  }

  if (checking) {
    return <main className="flex min-h-screen items-center justify-center bg-sigma-blue-deep"><p className="text-sm text-sand-dark">Carregando…</p></main>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sigma-blue-deep px-6">
        <div className="w-full max-w-sm rounded-2xl border border-white/8 bg-sigma-blue-dark/80 p-8">
          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gold/60">Sigma Horus — Plataforma</p>
          <h1 className="mt-3 text-xl font-semibold text-sand-light">Acesso restrito</h1>
          <p className="mt-2 text-sm text-sand-dark">Informe o token do dono da plataforma para ver os erros em produção.</p>
          <form onSubmit={submitToken} className="mt-6 space-y-4">
            <Input label="Token da plataforma" type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="••••••••••••" error={tokenError} autoFocus />
            <Button type="submit" className="w-full">Entrar</Button>
          </form>
        </div>
      </main>
    );
  }

  const openCount = items.filter((i) => !i.resolvedAt).length;
  return (
    <main className="min-h-screen bg-sigma-blue-deep px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/plataforma" className="text-xs text-gold transition hover:text-gold-light">&larr; Plataforma</Link>
          <h1 className="mt-2 text-2xl font-bold text-sand-light">Erros em produção</h1>
          <p className="mt-1 text-sm text-sand-dark">
            Cada linha é um tipo de erro (mesma rota e mesma mensagem), com quantas vezes ocorreu. {openCount} em aberto.
            Marque como resolvido depois de corrigir: se voltar, reabre sozinho e avisa por e-mail (ERROR_ALERT_EMAIL).
          </p>
        </div>
        {error ? <Alert intent="danger">{error}</Alert> : null}
        {items.length === 0 ? (
          <EmptyState title="Nenhum erro registrado." description="Quando uma tela ou rota falhar em produção, ela aparece aqui." />
        ) : (
          <div className="space-y-3">
            {items.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>{r.method ? `${r.method} ` : ''}{r.route}</CardTitle>
                    <CardDescription>{r.message}</CardDescription>
                    <p className="mt-1 text-xs text-sand-dark/80">
                      {r.count}× · {r.source === 'client' ? 'tela' : 'servidor'} · primeira {fmt(r.firstSeenAt)} · última {fmt(r.lastSeenAt)}{r.digest ? ` · código ${r.digest}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.resolvedAt ? 'success' : 'error'}>{r.resolvedAt ? 'Resolvido' : 'Aberto'}</Badge>
                    {r.stack ? <Button variant="ghost" size="sm" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Ocultar pilha' : 'Ver pilha'}</Button> : null}
                    <Button variant="ghost" size="sm" onClick={() => void toggle(r)}>{r.resolvedAt ? 'Reabrir' : 'Marcar resolvido'}</Button>
                  </div>
                </div>
                {open === r.id && r.stack ? <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-sand-dark">{r.stack}</pre> : null}
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
