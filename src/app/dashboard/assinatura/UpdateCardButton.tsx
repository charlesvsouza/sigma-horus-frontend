'use client';

import { useState } from 'react';

// Abre o portal do Stripe para atualizar o cartão de uma assinatura em atraso, sem contratar de novo.
export function UpdateCardButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? 'Não foi possível abrir a atualização do cartão.');
    } catch {
      setError('Não foi possível conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-sigma-blue-deep transition hover:bg-gold-light disabled:opacity-60"
      >
        {loading ? 'Abrindo…' : 'Atualizar cartão'}
      </button>
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
