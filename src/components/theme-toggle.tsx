'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

// Aplica a escolha no <html>. 'dark' = sem atributo (padrão :root); 'light' e
// 'system' usam data-theme — o CSS resolve o 'system' via prefers-color-scheme.
function apply(theme: Theme) {
  const el = document.documentElement;
  if (theme === 'dark') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', theme);
}

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Escuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
];

// Alterna o tema da interface. Persiste em localStorage e aplica no <html> —
// vale para todo o sistema (ver globals.css [data-theme]).
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('sigma-theme')) as Theme | null;
    // Init hidratação-safe do tema a partir do localStorage (só no cliente);
    // não é fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(saved === 'light' || saved === 'system' ? saved : 'dark');
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    try { localStorage.setItem('sigma-theme', next); } catch {}
    apply(next);
  }

  return (
    <div className="inline-flex rounded-full border border-white/10 bg-sigma-blue-deep/60 p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => choose(o.value)}
          className={`rounded-full px-4 py-1.5 text-sm transition-colors ${theme === o.value ? 'bg-gold/15 text-gold' : 'text-sand-dark hover:text-sand-light'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
