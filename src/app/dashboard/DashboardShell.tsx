'use client';

import Image from 'next/image';
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
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
    <div className="min-h-screen bg-sigma-blue-deep text-sand">
      <div className="flex">
        {open ? (
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-sigma-blue-deep/80 backdrop-blur-sm lg:hidden"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/[6%] bg-sigma-blue-dark/95 transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center justify-between border-b border-white/[5%] px-6 py-5">
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image
                src="/icon.png"
                alt=""
                aria-hidden="true"
                width={512}
                height={512}
                className="h-9 w-auto"
              />
              <span className="block">
                <span className="block font-display text-sm font-semibold tracking-[0.18em] text-sand-light">SIGMA HORUS</span>
                <span className="mt-0.5 block text-xs text-sand-dark">A tesouraria no prumo</span>
              </span>
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="text-sand-dark transition hover:text-sand lg:hidden"
              aria-label="Fechar menu"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-6">
            {groups.map((group) => {
              const isCollapsed = collapsed[group.category];
              return (
                <div key={group.category}>
                  <button
                    onClick={() => toggleCategory(group.category)}
                    className="flex w-full items-center justify-between px-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-sand-dark/70 transition hover:text-sand"
                  >
                    {group.category}
                    <svg
                      className={`h-3 w-3 text-sand-dark/50 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
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
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                              active
                                ? 'bg-gold/10 font-medium text-gold'
                                : 'text-sand/70 hover:bg-white/[3%] hover:text-sand'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-150 ${active ? 'bg-gold' : 'bg-white/[8%]'}`} />
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

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-0">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/[6%] bg-sigma-blue-deep/85 px-5 py-3.5 backdrop-blur-sm lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setOpen(true)}
                className="flex items-center justify-center rounded-lg border border-white/[8%] px-2.5 py-1.5 text-sand/70 transition hover:border-white/[12%] hover:text-sand lg:hidden"
                aria-label="Abrir menu"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0">
                <p className="text-[0.6rem] uppercase tracking-[0.25em] text-sand-dark/60">Loja maçônica</p>
                <h1 className="truncate text-base font-semibold text-sand-light">{lodgeName}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-sand-light">{userName}</p>
                <p className="text-xs text-gold/70">{ROLE_LABEL[role] ?? role}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-xs font-semibold text-gold">
                {initials}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="rounded-full border border-white/[8%] px-3.5 py-1.5 text-xs text-sand/60 transition hover:border-rose-500/30 hover:text-rose-300"
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
