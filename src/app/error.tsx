'use client';

import { useEffect } from 'react';

// Falha ao desenhar uma tela: mostra um aviso claro (em vez da página em branco do Next) e avisa o
// monitoramento (/api/client-error). O código (digest) liga esta falha ao log do servidor.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold text-sand-light">Algo deu errado nesta tela</h1>
        <p className="mt-2 text-sm text-sand-dark">
          O problema já foi registrado e será analisado. Tente de novo; se continuar, avise a Secretaria
          {error.digest ? <> informando o código <strong>{error.digest}</strong></> : null}.
        </p>
        <button type="button" onClick={reset} className="mt-6 rounded-full border border-gold/40 px-5 py-2 text-sm font-medium text-gold transition hover:border-gold/70">
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
