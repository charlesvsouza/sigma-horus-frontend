'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

function apply(theme: Theme) {
  const el = document.documentElement;
  if (theme === 'light') el.setAttribute('data-theme', 'light');
  else el.removeAttribute('data-theme');
}

// Alterna o tema da interface (escuro padrão ↔ claro). Persiste em localStorage
// e aplica no <html> — vale para todo o sistema (ver globals.css [data-theme]).
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('sigma-theme')) as Theme | null;
    setTheme(saved === 'light' ? 'light' : 'dark');
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    try { localStorage.setItem('sigma-theme', next); } catch {}
    apply(next);
  }

  return (
    <div className="inline-flex rounded-full border border-white/10 bg-sigma-blue-deep/60 p-1">
      <button
        type="button"
        onClick={() => choose('dark')}
        className={`rounded-full px-4 py-1.5 text-sm transition-colors ${theme === 'dark' ? 'bg-gold/15 text-gold' : 'text-sand-dark hover:text-sand-light'}`}
      >
        Escuro
      </button>
      <button
        type="button"
        onClick={() => choose('light')}
        className={`rounded-full px-4 py-1.5 text-sm transition-colors ${theme === 'light' ? 'bg-gold/15 text-gold' : 'text-sand-dark hover:text-sand-light'}`}
      >
        Claro
      </button>
    </div>
  );
}
