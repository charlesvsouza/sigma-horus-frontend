'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inputClass } from '@/components/ui';

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
const ROLE_OPTIONS = Object.entries(ROLE_LABELS);

export default function UsuariosClient({ users, denied }: { users: AppUser[]; denied: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    denied ? { kind: 'error', text: 'Sem permissão para gerenciar usuários.' } : null,
  );
  const [busy, setBusy] = useState<string | null>(null);

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

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-sand-light">Usuários & acessos</h1>
            <p className="mt-1 text-sm text-sand-dark">
              Defina o papel (cargo de permissão) de cada usuário. O acesso do obreiro é criado em <Link href="/dashboard/membros" className="text-gold/80 underline hover:text-gold">Membros</Link> → &ldquo;Conceder acesso&rdquo;.
            </p>
          </div>
          <Link href="/dashboard/configuracoes/permissoes" className="rounded-full border border-gold/40 px-4 py-2 text-sm font-medium text-gold/80 transition-all duration-200 ease-out hover:border-gold/60 hover:text-gold">
            Permissões por cargo →
          </Link>
        </div>

        {message ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${message.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>{message.text}</div>
        ) : null}

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-2">
          {denied ? (
            <p className="p-6 text-sm text-sand-dark">Apenas o Administrador da loja pode gerenciar usuários.</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-sm text-sand-dark">Nenhum usuário ainda.</p>
          ) : (
            <ul className="divide-y divide-white/[6%]">
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
