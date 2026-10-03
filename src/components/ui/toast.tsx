'use client';

import { useEffect, useRef } from 'react';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';

export type ToastMessage = { kind: 'ok' | 'error'; text: string } | null;

// Retorno de uma ação (salvar, pagar, enviar…) como aviso flutuante: fica sempre à vista — no celular
// a mensagem presa ao topo da tela passava despercebida quando a página estava rolada — e é anunciado
// por leitor de tela (aria-live). Sucesso some sozinho; erro fica até ser fechado, para dar tempo de ler.
// Uso: <Toast message={message} onClose={() => setMessage(null)} /> com `message` no formato { kind, text }.
export function Toast({ message, onClose, durationMs = 6000 }: { message: ToastMessage; onClose: () => void; durationMs?: number }) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!message || message.kind === 'error') return;
    const timer = setTimeout(() => closeRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs]);

  if (!message) return null;
  const error = message.kind === 'error';
  const Icon = error ? TriangleAlert : CircleCheck;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-90 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6 print:hidden">
      <div
        role={error ? 'alert' : 'status'}
        aria-live={error ? 'assertive' : 'polite'}
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl shadow-black/40 backdrop-blur-md ${
          error ? 'border-rose-400/40 bg-rose-950/90 text-rose-100' : 'border-emerald-400/40 bg-emerald-950/90 text-emerald-100'
        }`}
      >
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 wrap-break-word">{message.text}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar aviso"
          className="-my-1 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-80 transition hover:bg-white/10 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
