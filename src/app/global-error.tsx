'use client';

import { useEffect } from 'react';

// Última rede de proteção: falha no layout raiz. Precisa trazer o próprio <html>/<body> e não pode
// depender de estilos do app.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#0b1b33', color: '#f3ecd9', margin: 0 }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 20 }}>O Sigma Horus encontrou um problema</h1>
            <p style={{ fontSize: 14, opacity: 0.8 }}>
              O problema já foi registrado. Tente de novo{error.digest ? <> (código <strong>{error.digest}</strong>)</> : null}.
            </p>
            <button type="button" onClick={reset} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 999, border: '1px solid #c9a24b', background: 'transparent', color: '#c9a24b', cursor: 'pointer' }}>
              Tentar de novo
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
