'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: 'danger' | 'default';
}

type AskConfirm = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<AskConfirm | null>(null);

// Diálogo de confirmação do design system, substituindo o window.confirm nativo.
// Uso: `const askConfirm = useConfirm(); if (!(await askConfirm({...}))) return;`.
// O nome `askConfirm` evita sombrear o `confirm` global e deixa claro que é async.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const askConfirm = useCallback<AskConfirm>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }, []);

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts, close]);

  const danger = opts?.intent === 'danger';

  return (
    <ConfirmContext.Provider value={askConfirm}>
      {children}
      {opts ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-sigma-blue-deep/70 px-4 backdrop-blur-sm"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/[10%] bg-sigma-card-elevated p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {opts.title ? <h2 className="text-base font-semibold text-sand-light">{opts.title}</h2> : null}
            <div className={`text-sm text-sand ${opts.title ? 'mt-2' : ''}`}>{opts.message}</div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => close(false)}
                className="rounded-full border border-white/[10%] px-4 py-2 text-sm text-sand-dark transition-colors hover:text-sand"
              >
                {opts.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  danger
                    ? 'bg-rose-600 text-sand-light hover:bg-rose-500'
                    : 'bg-gold text-sigma-blue-deep hover:bg-gold-light'
                }`}
              >
                {opts.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): AskConfirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm precisa do <ConfirmProvider>.');
  return ctx;
}
