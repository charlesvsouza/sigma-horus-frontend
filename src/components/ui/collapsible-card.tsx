'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

// Card recolhível para listas — evita mostrar uma seção cheia de espaço vazio
// (EmptyState) sempre aberta. Abre sozinho na transição de 0 → 1+ registros
// (ex.: "Contas cadastradas" começa recolhido antes da primeira conta), mas
// não força de novo depois disso, respeitando se o usuário recolher de novo.
interface CollapsibleCardProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CollapsibleCard({ title, count, defaultOpen = false, headerAction, children, className = '' }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const wasEmpty = useRef(count === 0);

  useEffect(() => {
    if (wasEmpty.current && count > 0) setOpen(true);
    wasEmpty.current = count === 0;
  }, [count]);

  return (
    <section className={`rounded-xl border border-white/[6%] bg-sigma-card p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center justify-between gap-3 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          <div>
            <h2 className="text-base font-semibold text-sand-light">{title}</h2>
            <p className="mt-0.5 text-xs text-sand-dark">{count} registro{count !== 1 ? 's' : ''}</p>
          </div>
          <svg className={`h-4 w-4 shrink-0 text-sand-dark transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {headerAction}
      </div>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
