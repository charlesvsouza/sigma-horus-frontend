'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (next !== confirm) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? 'Não foi possível trocar a senha.');
      return;
    }
    // Reautentica para obter um token sem a flag de troca obrigatória.
    await signIn('credentials', { redirect: false, email, password: next });
    window.location.href = '/dashboard';
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <Input label="Senha atual" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" required />
      <Input label="Nova senha" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="mínimo 8 caracteres" required />
      <Input label="Confirmar nova senha" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="repita a nova senha" required />
      {error ? <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Salvando…' : 'Salvar nova senha'}
      </Button>
    </form>
  );
}
