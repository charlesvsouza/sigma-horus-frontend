'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, inputClass } from '@/components/ui';

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  memberId: string | null;
  mustChangePassword: boolean;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  venerable: 'Venerável',
  treasurer: 'Tesoureiro',
  secretary: 'Secretário',
  hospitaller: 'Hospitaleiro',
  member: 'Membro',
};
// Administrador não é opção de promoção: quem precisa de outro Administrador usa "Novo administrador".
const ROLE_OPTIONS = Object.entries(ROLE_LABELS).filter(([value]) => value !== 'admin');
const MAX_ADMINS = 2;

export default function UsuariosClient({ users, denied }: { users: AppUser[]; denied: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    denied ? { kind: 'error', text: 'Sem permissão para gerenciar usuários.' } : null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [showNewAdmin, setShowNewAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '' });
  const activeAdmins = users.filter((u) => u.role === 'admin' && u.status === 'active').length;

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setMessage(null);
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage({ kind: 'error', text: data.error ?? 'Erro ao atualizar.' });
      return;
    }
    if (body.action === 'reset-password') {
      setMessage({
        kind: 'ok',
        text: data.emailStatus === 'sent'
          ? 'Nova senha provisória enviada por e-mail.'
          : `Senha provisória gerada: ${data.tempPassword} (e-mail não enviado — repasse manualmente).`,
      });
    } else {
      setMessage({ kind: 'ok', text: 'Usuário atualizado.' });
    }
    router.refresh();
  }

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy('new-admin');
    setMessage(null);
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAdmin),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage({ kind: 'error', text: data.error ?? 'Não foi possível criar o Administrador.' });
      return;
    }
    setMessage({
      kind: 'ok',
      text: data.emailStatus === 'sent'
        ? `Administrador criado. A senha provisória foi enviada para ${newAdmin.email}.`
        : `Administrador criado. Senha provisória: ${data.tempPassword} (e-mail não enviado — repasse manualmente).`,
    });
    setNewAdmin({ name: '', email: '' });
    setShowNewAdmin(false);
    router.refresh();
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Usuários & acessos</h1>
            <p className="mt-1 text-sm text-sand-dark">
              Defina o papel (cargo de permissão) de cada usuário. O acesso do obreiro é criado em <Link href="/dashboard/membros" className="text-gold/80 underline hover:text-gold">Membros</Link> → &ldquo;Conceder acesso&rdquo;.
            </p>
          </div>
          <Link href="/dashboard/configuracoes/permissoes" className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-all duration-200 ease-out hover:border-gold/60 hover:text-gold">
            Permissões por cargo →
          </Link>
        </div>

        {message ? (
          <Alert intent={message.kind === 'ok' ? 'ok' : 'danger'}>{message.text}</Alert>
        ) : null}

        {!denied ? (
          <section className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-sand-light">Administradores ({activeAdmins} de {MAX_ADMINS})</h2>
                <p className="mt-1 text-xs text-sand-dark">
                  O papel de Administrador é fixo: ninguém é promovido a ele nem rebaixado dele. Para ter outro, crie-o aqui com um
                  <strong> e-mail próprio</strong> — nunca o de um membro.
                </p>
              </div>
              <Button type="button" variant="secondary" aria-expanded={showNewAdmin} aria-controls="novo-admin" disabled={activeAdmins >= MAX_ADMINS} onClick={() => setShowNewAdmin((v) => !v)}>
                Novo administrador
              </Button>
            </div>
            {activeAdmins >= MAX_ADMINS ? <p className="mt-2 text-xs text-amber-300">Limite de {MAX_ADMINS} Administradores ativos atingido. Desative um para criar outro.</p> : null}
            {showNewAdmin ? (
              <form id="novo-admin" onSubmit={createAdmin} className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Nome completo">
                  <input className={inputClass} value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} required minLength={3} />
                </Field>
                <Field label="E-mail de acesso do Administrador">
                  <input className={inputClass} type="email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} required />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={busy === 'new-admin'}>{busy === 'new-admin' ? 'Criando…' : 'Criar e enviar senha provisória'}</Button>
                </div>
              </form>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-xl border border-white/6 bg-sigma-card p-2">
          {denied ? (
            <p className="p-6 text-sm text-sand-dark">Apenas o Administrador da loja pode gerenciar usuários.</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-sm text-sand-dark">Nenhum usuário ainda.</p>
          ) : (
            <ul className="divide-y divide-white/6">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-sand-light">{u.name}</p>
                    <p className="truncate text-xs text-sand-dark">{u.email}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[0.65rem]">
                      {u.memberId ? <span className="rounded-full bg-gold/10 px-2 py-0.5 text-gold/80">obreiro</span> : null}
                      {u.status !== 'active' ? <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-300">inativo</span> : null}
                      {u.mustChangePassword ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300">senha provisória</span> : null}
                    </div>
                  </div>

                  {u.role === 'admin' ? (
                    <span className="flex items-center gap-2 text-xs text-sand-dark">
                      Papel <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-gold">Administrador (fixo)</span>
                    </span>
                  ) : (
                    <label className="flex items-center gap-2 text-xs text-sand-dark">
                      Papel
                      <select
                        value={u.role}
                        disabled={busy === u.id}
                        onChange={(e) => patch(u.id, { role: e.target.value })}
                        className={inputClass + ' py-1.5'}
                      >
                        {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy === u.id}
                      onClick={() => patch(u.id, { action: 'reset-password' })}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-sand-dark transition-colors hover:text-sand-light disabled:opacity-40"
                    >
                      Reenviar senha
                    </button>
                    <button
                      type="button"
                      disabled={busy === u.id}
                      onClick={() => patch(u.id, { status: u.status === 'active' ? 'inactive' : 'active' })}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-sand-dark transition-colors hover:text-sand-light disabled:opacity-40"
                    >
                      {u.status === 'active' ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link href="/dashboard/configuracoes" className="inline-block text-sm text-sand-dark transition-colors hover:text-sand-light">
          ← Voltar às configurações
        </Link>
      </div>
    </main>
  );
}
