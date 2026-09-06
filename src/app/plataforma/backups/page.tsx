'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, type BadgeVariant, Button, Card, CardDescription, CardTitle, EmptyState, Input } from '@/components/ui';

// Painel do dono da plataforma (não é multi-tenant): histórico do backup
// completo (todas as lojas) e disparo manual. Mesmo token compartilhado de
// /plataforma/convites (sessionStorage — some ao fechar a aba).
const TOKEN_KEY = 'sigma-platform-token';

interface BackupRow {
  id: string;
  storageKey: string | null;
  status: string;
  sizeBytes: number | null;
  totalRows: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  success: { variant: 'success', label: 'Sucesso' },
  failed: { variant: 'error', label: 'Falhou' },
};

function fmtDate(v: string) {
  return new Date(v).toLocaleString('pt-BR');
}

function fmtSize(bytes: number | null) {
  if (bytes == null) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDuration(ms: number | null) {
  if (ms == null) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function BackupsPlataformaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [checking, setChecking] = useState(true);

  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState('');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [runMessage, setRunMessage] = useState('');

  async function loadBackups(t: string): Promise<boolean> {
    setLoadingList(true);
    setListError('');
    const res = await fetch('/api/backups', { headers: { 'x-platform-token': t } });
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setTokenError('Token inválido ou expirado. Informe novamente.');
      setLoadingList(false);
      return false;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setListError(data.error ?? 'Não foi possível carregar os backups.');
      setLoadingList(false);
      return false;
    }
    setBackups(data.backups ?? []);
    setLoadingList(false);
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
      const ok = await loadBackups(saved);
      if (ok) setToken(saved);
      setChecking(false);
    })();
  }, []);

  async function handleTokenSubmit(event: FormEvent) {
    event.preventDefault();
    setTokenError('');
    const t = tokenInput.trim();
    if (!t) return;
    const ok = await loadBackups(t);
    if (ok) {
      sessionStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setTokenInput('');
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setBackups([]);
  }

  async function handleRunNow() {
    if (!token) return;
    setRunning(true);
    setRunError('');
    setRunMessage('');
    const res = await fetch('/api/backups', { method: 'POST', headers: { 'x-platform-token': token } });
    const data = await res.json().catch(() => ({}));
    setRunning(false);

    if (res.status === 401) {
      handleLogout();
      setTokenError('Sessão expirada. Informe o token novamente.');
      return;
    }
    if (!res.ok || !data.ok) {
      setRunError(data.error ?? 'O backup falhou.');
      loadBackups(token);
      return;
    }
    setRunMessage(`Backup concluído: ${data.totalRows} registro(s), ${fmtSize(data.sizeBytes)}.`);
    loadBackups(token);
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
            Informe o token do dono da plataforma para ver o histórico de backups.
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-gold/60">Sigma Horus — Plataforma</p>
            <h1 className="mt-2 text-2xl font-bold text-sand-light">Backups da plataforma</h1>
            <p className="mt-1 text-sm text-sand-dark">
              Backup completo (todas as lojas) roda automaticamente 1×/dia, criptografado, guardado por 30 dias.
              Restauração é só por script de linha de comando — ver AGENTS.md.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start">
            <Link href="/plataforma/convites" className="text-sm text-gold-light hover:text-gold">Convites →</Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>Sair</Button>
          </div>
        </div>

        <Card>
          <CardTitle>Rodar agora</CardTitle>
          <CardDescription>Dispara um backup completo imediatamente, fora do horário agendado.</CardDescription>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleRunNow} disabled={running}>
              {running ? 'Rodando…' : 'Rodar backup agora'}
            </Button>
          </div>
          {runError ? <Alert intent="danger" className="mt-4">{runError}</Alert> : null}
          {runMessage ? <Alert intent="ok" className="mt-4">{runMessage}</Alert> : null}
        </Card>

        <div>
          <h2 className="text-base font-semibold text-sand-light">Histórico</h2>

          {listError ? <Alert intent="danger" className="mt-3">{listError}</Alert> : null}

          {loadingList ? (
            <p className="mt-4 text-sm text-sand-dark">Carregando…</p>
          ) : backups.length === 0 ? (
            <EmptyState
              title="Nenhum backup ainda"
              description="Clique em “Rodar backup agora” ou aguarde o horário agendado (03:00 UTC)."
            />
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/[6%]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/[6%] bg-sigma-card">
                  <tr>
                    <th className="px-3 py-3 text-xs font-semibold uppercase text-sand-dark">Data</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase text-sand-dark">Status</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase text-sand-dark">Registros</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase text-sand-dark">Tamanho</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase text-sand-dark">Duração</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase text-sand-dark">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => {
                    const badge = STATUS_BADGE[b.status] ?? { variant: 'info' as BadgeVariant, label: b.status };
                    return (
                      <tr key={b.id} className="border-b border-white/[5%] transition-colors hover:bg-white/[3%]">
                        <td className="whitespace-nowrap px-3 py-3 text-sand-light">{fmtDate(b.createdAt)}</td>
                        <td className="whitespace-nowrap px-3 py-3"><Badge variant={badge.variant}>{badge.label}</Badge></td>
                        <td className="px-3 py-3 text-sand-dark">{b.totalRows ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-sand-dark">{fmtSize(b.sizeBytes)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-sand-dark">{fmtDuration(b.durationMs)}</td>
                        <td className="max-w-[16rem] truncate px-3 py-3 text-rose-300" title={b.error ?? undefined}>
                          {b.error ?? '—'}
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
