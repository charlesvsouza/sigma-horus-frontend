'use client';

import { useEffect, useState } from 'react';
import { createDedupedFetch } from '@/lib/write-dedupe';

// Rede de proteção global da interface: (1) duplo clique/duas abas não gravam duas vezes a mesma ação
// (lib/write-dedupe) e (2) quando a conexão cai, avisa — sem isso muitas telas só "não faziam nada" e a
// pessoa achava que tinha salvo. Montado uma vez no layout raiz.

const FLAG = '__sigmaNetworkGuard';
const MSG_OFFLINE = 'Sem conexão com a internet. O que você fizer agora pode não ser salvo.';
const MSG_FAILED = 'Não conseguimos falar com o servidor. A última ação pode não ter sido salva — confira antes de repetir.';

export function NetworkGuard() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    if (!w[FLAG]) {
      w[FLAG] = true;
      window.fetch = createDedupedFetch(window.fetch.bind(window), () => window.dispatchEvent(new Event('sigma:write-failed')));
    }
    const offline = () => setMessage(MSG_OFFLINE);
    const online = () => setMessage((m) => (m === MSG_OFFLINE ? null : m));
    const failed = () => setMessage(navigator.onLine ? MSG_FAILED : MSG_OFFLINE);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    window.addEventListener('sigma:write-failed', failed);
    if (!navigator.onLine) offline();
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      window.removeEventListener('sigma:write-failed', failed);
    };
  }, []);

  if (!message) return null;
  return (
    <div role="alert" className="rpt-noprint fixed inset-x-0 bottom-4 z-[100] mx-auto flex w-[min(92vw,34rem)] items-start gap-3 rounded-xl border border-amber-500/40 bg-sigma-blue-deep/95 px-4 py-3 text-sm text-amber-200 shadow-xl">
      <span className="flex-1">{message}</span>
      <button type="button" onClick={() => setMessage(null)} className="rounded-full border border-amber-500/40 px-3 py-0.5 text-xs hover:border-amber-500/70">Fechar</button>
    </div>
  );
}
