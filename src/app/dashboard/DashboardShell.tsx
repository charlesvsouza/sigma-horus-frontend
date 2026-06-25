'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ReactNode, useEffect, useState } from 'react';

interface NavItem { href: string; label: string; }
interface NavGroup { category: string; items: NavItem[]; }

interface Props {
  groups: NavGroup[];
  lodgeName: string;
  userName: string;
  role: string;
  children: ReactNode;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  venerable: 'Venerável',
  treasurer: 'Tesoureiro',
  secretary: 'Secretário',
  member: 'Obreiro',
};

export default function DashboardShell({ groups, lodgeName, userName, role, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Restaura categorias recolhidas do navegador.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sh.nav.collapsed');
      if (saved) setCollapsed(JSON.parse(saved));
    } catch {}
  }, []);

  function toggleCategory(name: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      try { localStorage.setItem('sh.nav.collapsed', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'SH';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex">
        {/* Backdrop (mobile) */}
        {open ? <div onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden" /> : null}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-slate-900/95 transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
            <Link href="/dashboard" className="block">
              <p className="text-[0.7rem] uppercase tracking-[0.4em] text-amber-400">Sigma Horus</p>
              <p className="mt-1 text-sm font-medium text-slate-300">A tesouraria no prumo</p>
            </Link>
            <button onClick={() => setOpen(false)} className="text-slate-400 lg:hidden" aria-label="Fechar menu">✕</button>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-6">
            {groups.map((group) => {
              const isCollapsed = collapsed[group.category];
              return (
                <div key={group.category}>
                  <button
                    onClick={() => toggleCategory(group.category)}
                    className="flex w-full items-center justify-between px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-300"
                  >
                    {group.category}
                    <span className={`text-slate-600 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>›</span>
                  </button>
                  {!isCollapsed ? (
                    <div className="mt-2 space-y-0.5">
                      {group.items.map((item) => {
                        const active = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                              active
                                ? 'bg-amber-400/10 font-medium text-amber-200'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-amber-400' : 'bg-slate-700'}`} />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Conteúdo */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-0">
          {/* Hero / header de identificação */}
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950/85 px-5 py-4 backdrop-blur lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setOpen(true)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-slate-300 lg:hidden" aria-label="Abrir menu">☰</button>
              <div className="min-w-0">
                <p className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-500">Loja maçônica</p>
                <h1 className="truncate text-lg font-semibold text-white">{lodgeName}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-100">{userName}</p>
                <p className="text-xs text-amber-300/80">{ROLE_LABEL[role] ?? role}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-xs font-semibold text-amber-200">
                {initials}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="rounded-full border border-white/10 px-3.5 py-1.5 text-sm text-slate-300 transition hover:border-rose-400/40 hover:text-rose-200"
              >
                Sair
              </button>
            </div>
          </header>

          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
