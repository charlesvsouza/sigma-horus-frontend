'use client';

import { useEffect } from 'react';
import { Alert, Button } from '@/components/ui';

// Rede de segurança do painel: um erro inesperado numa tela mostra isto em vez da página
// de erro genérica, e deixa tentar de novo sem perder a navegação.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-6 py-12">
      <h1 className="font-display text-2xl font-bold text-sand-light">Algo não saiu como esperado</h1>
      <Alert intent="danger">
        Não foi possível carregar esta tela. Seus dados não foram alterados. Tente de novo; se persistir, avise o suporte
        {error.digest ? <> informando o código <strong className="tabular-nums">{error.digest}</strong></> : null}.
      </Alert>
      <Button type="button" onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
