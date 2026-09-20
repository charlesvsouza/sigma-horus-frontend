'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, Button, Card, CardDescription, CardTitle, Field, inputClass } from '@/components/ui';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador', venerable: 'Venerável', treasurer: 'Tesoureiro', secretary: 'Secretário', hospitaller: 'Hospitaleiro', member: 'Membro',
};

type Msg = { kind: 'ok' | 'error'; text: string } | null;

export default function MinhaContaClient({ name, email, role, isMember }: { name: string; email: string; role: string; isMember: boolean }) {
  const [profile, setProfile] = useState({ name, newEmail: '', currentPassword: '' });
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<'profile' | 'pwd' | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy('profile');
    setProfileMsg(null);
    const body: Record<string, string> = {};
    if (profile.name.trim() !== name) body.name = profile.name;
    if (profile.newEmail.trim()) { body.newEmail = profile.newEmail; body.currentPassword = profile.currentPassword; }
    const res = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setProfileMsg({ kind: 'error', text: data.error ?? 'Não foi possível salvar.' }); return; }
    const parts = [];
    if (data.nameUpdated) parts.push('Nome atualizado.');
    if (data.emailPending) parts.push(`Enviamos um link de confirmação para ${data.emailPending}. O e-mail de acesso só muda depois que você abrir o link (vale por 1 hora).`);
    setProfileMsg({ kind: 'ok', text: parts.join(' ') });
    setProfile((p) => ({ ...p, newEmail: '', currentPassword: '' }));
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (pwd.next.length < 8) { setPwdMsg({ kind: 'error', text: 'A nova senha deve ter pelo menos 8 caracteres.' }); return; }
    if (pwd.next !== pwd.confirm) { setPwdMsg({ kind: 'error', text: 'A confirmação não confere com a nova senha.' }); return; }
    setBusy('pwd');
    const res = await fetch('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setPwdMsg({ kind: 'error', text: data.error ?? 'Não foi possível trocar a senha.' }); return; }
    setPwd({ current: '', next: '', confirm: '' });
    setPwdMsg({ kind: 'ok', text: 'Senha alterada.' });
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-light">Minha conta</h1>
          <p className="mt-1 text-sm text-sand-dark">Seus dados de acesso. Papel atual: <strong className="text-sand-light">{ROLE_LABEL[role] ?? role}</strong> — o papel só é definido pelo Administrador e nunca muda por aqui.</p>
        </div>

        <Card className="space-y-4">
          <CardTitle>Nome e e-mail de acesso</CardTitle>
          {isMember ? (
            <CardDescription>
              Seu nome e e-mail de acesso são os do seu <strong>cadastro de obreiro</strong> ({email}). Para alterá-los, use{' '}
              <Link href="/dashboard/portal" className="text-gold underline">Meu portal → Editar meus dados</Link>.
            </CardDescription>
          ) : (
            <form onSubmit={saveProfile} className="space-y-4">
              <CardDescription>
                O e-mail é o seu login: para trocá-lo pedimos a senha atual e enviamos um link de confirmação ao <strong>novo</strong> e-mail — só depois de abrir o link a troca vale.
                {role === 'admin' ? ' Como Administrador, use um e-mail diferente do seu cadastro de obreiro (se você também for membro): os papéis não se confundem.' : ''}
              </CardDescription>
              {profileMsg ? <Alert intent={profileMsg.kind === 'ok' ? 'ok' : 'danger'}>{profileMsg.text}</Alert> : null}
              <Field label="Nome completo">
                <input className={inputClass} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required minLength={3} />
              </Field>
              <Field label={`E-mail de acesso atual: ${email}`}>
                <input className={inputClass} type="email" placeholder="Novo e-mail (deixe em branco para não trocar)" value={profile.newEmail} onChange={(e) => setProfile({ ...profile, newEmail: e.target.value })} />
              </Field>
              {profile.newEmail.trim() ? (
                <Field label="Senha atual (para confirmar a troca de e-mail)">
                  <input className={inputClass} type="password" autoComplete="current-password" value={profile.currentPassword} onChange={(e) => setProfile({ ...profile, currentPassword: e.target.value })} required />
                </Field>
              ) : null}
              <Button type="submit" disabled={busy === 'profile'}>{busy === 'profile' ? 'Salvando…' : 'Salvar'}</Button>
            </form>
          )}
        </Card>

        <Card className="space-y-4">
          <CardTitle>Senha</CardTitle>
          <form onSubmit={savePassword} className="space-y-4">
            {pwdMsg ? <Alert intent={pwdMsg.kind === 'ok' ? 'ok' : 'danger'}>{pwdMsg.text}</Alert> : null}
            <Field label="Senha atual">
              <input className={inputClass} type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nova senha (mín. 8 caracteres)">
                <input className={inputClass} type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} required />
              </Field>
              <Field label="Confirmar nova senha">
                <input className={inputClass} type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
              </Field>
            </div>
            <Button type="submit" variant="secondary" disabled={busy === 'pwd'}>{busy === 'pwd' ? 'Salvando…' : 'Trocar senha'}</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
