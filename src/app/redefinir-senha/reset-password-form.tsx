'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/account/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'Não foi possível redefinir a senha.');
      return;
    }
    setDone(true);
  }

  if (!token) {
    return <p className="mt-6 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">Link inválido. Peça um novo em &quot;Esqueceu a senha?&quot; na tela de entrada.</p>;
  }

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <p className="rounded-lg bg-gold/10 px-3 py-3 text-sm text-sand">Senha redefinida com sucesso. Já pode entrar com a nova senha.</p>
        <Link href="/login" className="block text-center text-sm text-gold hover:text-gold-light">Ir para o login</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <Input label="Nova senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 8 caracteres" required />
      <Input label="Confirmar nova senha" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="repita a nova senha" required />
      {error ? <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Salvando…' : 'Salvar nova senha'}
      </Button>
    </form>
  );
}
