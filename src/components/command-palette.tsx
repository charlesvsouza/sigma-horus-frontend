'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface Command { label: string; href: string; group: string; }

// Paleta de comandos (Ctrl/Cmd+K): busca e navega sem o mouse. Acelera o uso
// diário (tesoureiro). Abre pelo atalho ou pelo evento 'sigma:open-cmdk'
// (disparado pelo botão no cabeçalho).
export default function CommandPalette({ commands }: { commands: Command[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function reset(next: boolean) { setOpen(next); setQ(''); setActive(0); }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o); setQ(''); setActive(0);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    function onOpen() { reset(true); }
    window.addEventListener('keydown', onKey);
    window.addEventListener('sigma:open-cmdk', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('sigma:open-cmdk', onOpen);
    };
  }, []);

  const filtered = q
    ? commands.filter((c) => `${c.label} ${c.group}`.toLowerCase().includes(q.toLowerCase()))
    : commands;

  function go(href: string) { setOpen(false); router.push(href); }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) go(filtered[active].href); }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-sigma-blue-deep/70 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-white/[10%] bg-sigma-card-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={onInputKey}
          placeholder="Buscar telas e ações…"
          className="w-full border-b border-white/[8%] bg-transparent px-4 py-3.5 text-sm text-sand-light placeholder:text-sand-dark outline-none"
        />
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-sand-dark">Nada encontrado.</li>
          ) : filtered.map((c, i) => (
            <li key={c.href}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(c.href)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  i === active ? 'bg-gold/12 text-gold' : 'text-sand/80 hover:text-sand-light'
                }`}
              >
                <span>{c.label}</span>
                <span className="text-xs text-sand-dark/70">{c.group}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 border-t border-white/[8%] px-4 py-2 text-[0.65rem] text-sand-dark/70">
          <span>↑↓ navegar</span><span>↵ abrir</span><span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}
