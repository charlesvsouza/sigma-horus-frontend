'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import CommandPalette, { type Command } from '@/components/command-palette';
import {
  LayoutDashboard, CircleUser, BookOpen, Users, Database, Briefcase, Crown, Wallet,
  ReceiptText, CreditCard, ChartColumn, BookCheck, CalendarDays, FolderClosed,
  MessageSquare, Contact, HeartHandshake, Settings, KeyRound, Gem, Plug, ScrollText,
  PanelLeft, PanelLeftClose, Circle, type LucideIcon,
} from 'lucide-react';

interface NavItem { href: string; label: string; }
interface NavGroup { category: string; items: NavItem[]; }

// Um ícone (Lucide) por destino do menu. Mantido no cliente porque componentes
// não atravessam a fronteira RSC; o servidor passa só href/label.
const NAV_ICONS: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/portal': CircleUser,
  '/manual': BookOpen,
  '/dashboard/membros': Users,
  '/dashboard/cadastros': Database,
  '/dashboard/cargos': Briefcase,
  '/dashboard/veneralato': Crown,
  '/dashboard/contas': Wallet,
  '/dashboard/cobrancas': ReceiptText,
  '/dashboard/pagamentos': CreditCard,
  '/dashboard/relatorios': ChartColumn,
  '/dashboard/relatorios/fechamento': BookCheck,
  '/dashboard/sessoes': CalendarDays,
  '/dashboard/documentos': FolderClosed,
  '/dashboard/comunicacao': MessageSquare,
  '/dashboard/hospitalaria/irmaos': Contact,
  '/dashboard/hospitalaria/campanhas': HeartHandshake,
  '/dashboard/configuracoes': Settings,
  '/dashboard/configuracoes/usuarios': KeyRound,
  '/dashboard/assinatura': Gem,
  '/dashboard/integracoes': Plug,
  '/dashboard/auditoria': ScrollText,
};

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

// Rótulos de segmentos de rota para a trilha (breadcrumb) que não vêm do menu.
const SEGMENT_LABELS: Record<string, string> = {
  configuracoes: 'Configurações da loja', relatorios: 'Relatórios', hospitalaria: 'Hospitalaria',
  sessoes: 'Sessões', usuarios: 'Usuários & acessos', permissoes: 'Permissões',
  fechamento: 'Fechamento', irmaos: 'Irmãos', campanhas: 'Campanhas', portal: 'Meu portal',
};

export default function DashboardShell({ groups, lodgeName, userName, role, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [rail, setRail] = useState(false); // sidebar só-ícone no desktop

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sh.nav.collapsed');
      const railSaved = localStorage.getItem('sigma.sidebar.rail') === '1';
      // Init hidratação-safe a partir do localStorage (só existe no cliente);
      // não é o fetch-on-mount que a regra mira.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setCollapsed(JSON.parse(saved));
      if (railSaved) setRail(true);
    } catch {}
  }, []);

  function toggleRail() {
    setRail((r) => {
      const next = !r;
      try { localStorage.setItem('sigma.sidebar.rail', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  // Anti-bfcache: ao voltar pelo navegador, se a página vier do cache de
  // back/forward, recarrega para revalidar a sessão (após "Sair", o guard do
  // layout redireciona para /login).
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  function toggleCategory(name: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      try { localStorage.setItem('sh.nav.collapsed', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'SH';

  // Trilha (breadcrumb) derivada da rota: navegação na própria tela, sem depender
  // das setas do navegador. Cada nível é clicável quando corresponde a uma página.
  const hrefLabel = useMemo(() => {
    const map: Record<string, string> = { '/dashboard': 'Painel' };
    for (const g of groups) for (const it of g.items) map[it.href] = it.label;
    return map;
  }, [groups]);

  // Comandos (telas) para a paleta Ctrl/Cmd+K.
  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [{ label: 'Painel', href: '/dashboard', group: 'Geral' }];
    for (const g of groups) for (const it of g.items) list.push({ label: it.label, href: it.href, group: g.category });
    return list;
  }, [groups]);

  const crumbs = useMemo(() => {
    if (!pathname?.startsWith('/dashboard')) return [];
    const segs = pathname.split('/').filter(Boolean);
    let acc = '';
    return segs.map((seg, i) => {
      acc += `/${seg}`;
      const navigable = acc === '/dashboard' || hrefLabel[acc] !== undefined;
      let label = hrefLabel[acc] ?? SEGMENT_LABELS[seg];
      if (!label) label = /^[0-9a-z]{8,}$/i.test(seg) ? 'Detalhe' : seg.charAt(0).toUpperCase() + seg.slice(1);
      return { href: acc, label, navigable, last: i === segs.length - 1 };
    });
  }, [pathname, hrefLabel]);

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
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/[6%] bg-sigma-blue-dark/95 transition-[transform,width] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${rail ? 'lg:w-16' : ''} ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className={`flex items-center justify-between border-b border-white/[5%] py-5 ${rail ? 'lg:justify-center lg:px-0' : 'px-6'}`}>
            <Link href="/dashboard" className={`flex items-center gap-3 ${rail ? 'lg:gap-0' : ''}`}>
              <Image
                src="/icon.png"
                alt=""
                aria-hidden="true"
                width={512}
                height={512}
                className="h-9 w-auto"
              />
              <span className={`block ${rail ? 'lg:hidden' : ''}`}>
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

          <nav className={`flex-1 space-y-5 overflow-y-auto py-6 ${rail ? 'px-4 lg:px-2' : 'px-4'}`}>
            {groups.map((group) => {
              const isCollapsed = collapsed[group.category];
              return (
                <div key={group.category}>
                  <button
                    onClick={() => toggleCategory(group.category)}
                    className={`flex w-full items-center justify-between px-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-sand-dark/70 transition hover:text-sand ${rail ? 'lg:hidden' : ''}`}
                  >
                    {group.category}
                    <svg
                      className={`h-3 w-3 text-sand-dark/50 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className={`mt-2 space-y-0.5 ${isCollapsed ? 'hidden' : ''} ${rail ? 'lg:block! lg:mt-0' : ''}`}>
                      {group.items.map((item) => {
                        const active = pathname === item.href;
                        const Icon = NAV_ICONS[item.href] ?? Circle;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            title={rail ? item.label : undefined}
                            aria-label={item.label}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${rail ? 'lg:justify-center lg:px-0' : ''} ${
                              active
                                ? 'bg-gold/10 font-medium text-gold'
                                : 'text-sand/70 hover:bg-white/[3%] hover:text-sand'
                            }`}
                          >
                            <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-gold' : 'text-sand-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                            <span className={rail ? 'lg:hidden' : ''}>{item.label}</span>
                          </Link>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="hidden border-t border-white/[5%] p-3 lg:block">
            <button
              onClick={toggleRail}
              title={rail ? 'Expandir menu' : 'Recolher menu'}
              aria-label={rail ? 'Expandir menu' : 'Recolher menu'}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sand-dark transition-colors hover:bg-white/[3%] hover:text-sand ${rail ? 'justify-center px-0' : ''}`}
            >
              {rail
                ? <PanelLeft className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                : <PanelLeftClose className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />}
              <span className={rail ? 'hidden' : ''}>Recolher menu</span>
            </button>
          </div>
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
              <button
                onClick={() => window.dispatchEvent(new Event('sigma:open-cmdk'))}
                className="hidden items-center gap-2 rounded-full border border-white/[8%] px-3 py-1.5 text-xs text-sand-dark transition hover:border-gold/40 hover:text-sand sm:flex"
                aria-label="Buscar (Ctrl ou Cmd + K)"
                title="Buscar telas e ações"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
                <span className="hidden md:inline">Buscar</span>
                <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 font-mono text-[0.6rem] md:inline">⌘K</kbd>
              </button>
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

          {crumbs.length > 1 ? (
            <nav aria-label="Trilha de navegação" className="border-b border-white/[6%] bg-sigma-blue-deep/60 px-5 py-2.5 lg:px-8">
              <ol className="flex flex-wrap items-center gap-1.5 text-xs">
                {crumbs.map((c, i) => (
                  <li key={c.href} className="flex items-center gap-1.5">
                    {i > 0 ? <span className="text-sand-dark/40" aria-hidden="true">/</span> : null}
                    {c.last || !c.navigable ? (
                      <span className={c.last ? 'font-medium text-sand-light' : 'text-sand-dark'} aria-current={c.last ? 'page' : undefined}>{c.label}</span>
                    ) : (
                      <Link href={c.href} className="text-sand-dark transition-colors hover:text-gold">{c.label}</Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}

          <div className="flex-1 bg-sigma-app">{children}</div>
        </div>
      </div>
      <CommandPalette commands={commands} />
    </div>
  );
}
