'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import CommandPalette, { type Command } from '@/components/command-palette';
import { ConfirmProvider } from '@/components/ui';
import Art002Alert from '@/components/art002-alert';
import { QuickNavProvider, QuickNavToggle, SiblingNav } from '@/components/quick-nav';
import { SessionGuard } from '@/components/session-guard';
import { candidateMayVisit, isCandidateRole } from '@/lib/candidate';
import { badgeText, sumBadges, type NavBadge } from '@/lib/nav-badges';
import {
  LayoutDashboard, CircleUser, BookOpen, Users, Database, Briefcase, Crown, Wallet,
  ReceiptText, CreditCard, ChartColumn, BookCheck, CalendarDays, FolderClosed,
  MessageSquare, Contact, HeartHandshake, PiggyBank, Settings, KeyRound, Gem, Plug, ScrollText,
  PanelLeft, PanelLeftClose, Circle, TriangleAlert, ClipboardCheck, TrendingUp, PieChart,
  Landmark, ArrowLeftRight, Upload, Repeat, Archive, FileSpreadsheet, NotebookText, UserCheck,
  Scale, ListTree, Users2, Images, LayoutGrid, UsersRound, PencilLine,
  ArrowDownToLine, ArrowUpFromLine, HandCoins, Banknote, Percent, type LucideIcon,
  History, BadgeCheck, ShieldCheck, UserPlus, Award, UserRoundSearch, GraduationCap, Handshake,
} from 'lucide-react';

interface NavItem { href: string; label: string; badge?: NavBadge | null; }
interface NavSubgroup { label: string; items: NavItem[]; }
interface NavGroup { category: string; items: NavItem[]; subgroups: NavSubgroup[]; flat: boolean; }

// Todos os itens de uma categoria, soltos + dentro de subgrupos — usado onde
// a estrutura de 3 níveis não importa (breadcrumb, paleta de comandos,
// categoria ativa).
function allItems(g: NavGroup): NavItem[] {
  return [...g.items, ...g.subgroups.flatMap((sg) => sg.items)];
}

// A tela atual pertence a este endereço do menu? (igual, ou uma tela filha dele)
function isActiveHref(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return href !== '/dashboard' && pathname.startsWith(`${href}/`);
}

// Aviso numérico do menu: vermelho = algo atrasado; dourado = algo esperando conferência/decisão.
function badgePillClass(b: NavBadge): string {
  const tone = b.tone === 'alerta' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-gold/15 text-gold border-gold/30';
  return `inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 text-[0.65rem] font-semibold tabular-nums leading-4 tracking-normal normal-case ${tone}`;
}
function sumItems(items: NavItem[]): NavBadge | null {
  const count = sumBadges(items.map((i) => i.badge ?? undefined));
  if (count === 0) return null;
  const tone = items.some((i) => i.badge?.tone === 'alerta') ? 'alerta' : 'atencao';
  return { count, tone, hint: '' };
}
const subgroupBadge = (sg: NavSubgroup) => sumItems(sg.items);
const categoryBadge = (g: NavGroup) => sumItems(allItems(g));

// Ícone de cada categoria (usado no menu recolhido, onde só cabe um ícone por área).
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Social: Users2,
  Secretaria: Briefcase,
  Tesouraria: Wallet,
  Hospitalaria: HeartHandshake,
  'Administração': Settings,
};

// Um ícone (Lucide) por destino do menu. Mantido no cliente porque componentes
// não atravessam a fronteira RSC; o servidor passa só href/label.
const NAV_ICONS: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/portal': CircleUser,
  '/manual': BookOpen,
  '/dashboard/membros': Users,
  '/dashboard/candidatos': UserRoundSearch,
  '/dashboard/taxas-de-grau': GraduationCap,
  '/dashboard/acordos': Handshake,
  '/dashboard/membros/quadro-social': Users2,
  '/dashboard/galeria-veneraveis': Images,
  '/dashboard/quadro-gestao': LayoutGrid,
  '/dashboard/composicao': UsersRound,
  '/dashboard/cadastros': Database,
  '/dashboard/cargos': Briefcase,
  '/dashboard/veneralato': Crown,
  '/dashboard/materiais': Archive,
  '/dashboard/cadastros-financeiros': FileSpreadsheet,
  '/dashboard/contas': Wallet,
  '/dashboard/contas/lancamento': PencilLine,
  '/dashboard/cobrancas': ReceiptText,
  '/dashboard/pagamentos': CreditCard,
  '/dashboard/transferencias': Repeat,
  '/dashboard/extratos': NotebookText,
  '/dashboard/patrimonio': Landmark,
  '/dashboard/conciliacao-bancaria': ArrowLeftRight,
  '/dashboard/conferencia': ShieldCheck,
  '/dashboard/relatorios': ChartColumn,
  '/dashboard/relatorios/contas-a-receber': ArrowDownToLine,
  '/dashboard/relatorios/contas-a-pagar': ArrowUpFromLine,
  '/dashboard/relatorios/contas-recebidas': HandCoins,
  '/dashboard/relatorios/contas-pagas': Banknote,
  '/dashboard/relatorios/historico-pagamentos': History,
  '/dashboard/relatorios/declaracao-regularidade': BadgeCheck,
  '/dashboard/relatorios/tarifas': Percent,
  '/dashboard/relatorios/dre': Scale,
  '/dashboard/relatorios/categorias': ListTree,
  '/dashboard/relatorios/fechamento': BookCheck,
  '/dashboard/relatorios/inadimplencia': TriangleAlert,
  '/dashboard/relatorios/balancetes': ClipboardCheck,
  '/dashboard/relatorios/fluxo-caixa': TrendingUp,
  '/dashboard/relatorios/orcamento': PieChart,
  '/dashboard/sessoes': CalendarDays,
  '/dashboard/sessoes/frequencia': UserCheck,
  '/dashboard/visitantes': UserPlus,
  '/dashboard/certificados': Award,
  '/dashboard/portal/secretaria': CalendarDays,
  '/dashboard/documentos': FolderClosed,
  '/dashboard/comunicacao': MessageSquare,
  '/dashboard/hospitalaria/irmaos': Contact,
  '/dashboard/hospitalaria/campanhas': HeartHandshake,
  '/dashboard/hospitalaria/fundos': PiggyBank,
  '/dashboard/portal/hospitalaria': HeartHandshake,
  '/dashboard/configuracoes': Settings,
  '/dashboard/configuracoes/usuarios': KeyRound,
  '/dashboard/configuracoes/importar': Upload,
  '/dashboard/configuracoes/importar-financeiro': Upload,
  '/dashboard/assinatura': Gem,
  '/dashboard/integracoes': Plug,
  '/dashboard/auditoria': ScrollText,
};

interface Props {
  groups: NavGroup[];
  lodgeName: string;
  userName: string;
  role: string;
  /** Telas que não estão no menu mas entram na busca Ctrl/Cmd+K (ex.: relatórios do índice). */
  extraCommands?: Command[];
  children: ReactNode;
  /** Dias de atraso da mensalidade do usuário logado, só quando > 60 (Art. 002). */
  art002DaysOverdue?: number | null;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  venerable: 'Venerável',
  treasurer: 'Tesoureiro',
  secretary: 'Secretário',
  member: 'Obreiro',
  candidate: 'Candidato',
};

// Rótulos de segmentos de rota para a trilha (breadcrumb) que não vêm do menu.
const SEGMENT_LABELS: Record<string, string> = {
  configuracoes: 'Configurações da loja', relatorios: 'Relatórios', resumo: 'Resumo financeiro', hospitalaria: 'Hospitalaria',
  sessoes: 'Sessões', contrato: 'Contrato', 'taxas-de-grau': 'Taxas de grau', acordos: 'Acordos', usuarios: 'Usuários & acessos', 'minha-conta': 'Minha conta', permissoes: 'Permissões', 'importar-financeiro': 'Importar backup financeiro',
  fechamento: 'Fechamento', irmaos: 'Irmãos', campanhas: 'Campanhas', tarifas: 'Tarifas de cobrança (Asaas)', fundos: 'Fundos (Tronco e Doações)', portal: 'Meu portal', secretaria: 'Secretaria',
  inadimplencia: 'Inadimplência (Art. 002)', balancetes: 'Balancetes periódicos', categorias: 'Razão por categoria', 'historico-pagamentos': 'Histórico de pagamentos', historico: 'Meu histórico de pagamentos', 'declaracao-regularidade': 'Declaração de regularidade', declaracao: 'Declaração de regularidade',
  'fluxo-caixa': 'Fluxo de caixa projetado', orcamento: 'Orçamento anual',
  patrimonio: 'Patrimônio', 'conciliacao-bancaria': 'Conciliação bancária', conferencia: 'Conferência com o banco',
  completo: 'Relatório completo', balanco: 'Balanço Financeiro', balancete: 'Balancete de Verificação',
  'receitas-despesas': 'Receitas × Despesas', 'livro-caixa': 'Livro Caixa', cobrancas: 'Cobranças',
  'saldo-irmaos': 'Saldo dos Irmãos', whatsapp: 'Envio pelo WhatsApp', livro: 'Livro de presença', 'lista-visitantes': 'Lista de visitantes',
};

export default function DashboardShell({ groups, extraCommands = [], lodgeName, userName, role, children, art002DaysOverdue }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Candidato só tem o portal: qualquer outra tela do painel volta para ele. As
  // APIs já recusam o papel no servidor; isto evita a tela vazia/"acesso negado".
  const candidateBlocked = isCandidateRole(role) && !candidateMayVisit(pathname ?? '');
  useEffect(() => {
    if (candidateBlocked) router.replace('/dashboard/portal');
  }, [candidateBlocked, router]);
  const [rail, setRail] = useState(false); // sidebar só-ícone no desktop

  // Categoria da rota atual: abre por padrão no acordeão.
  const activeCategory = useMemo(() => {
    for (const g of groups) for (const it of allItems(g)) {
      if (pathname === it.href) return g.category;
      if (it.href !== '/dashboard' && pathname?.startsWith(`${it.href}/`)) return g.category;
    }
    return groups[0]?.category ?? null;
  }, [groups, pathname]);

  // Acordeão de UMA categoria aberta por vez (single-open).
  const [openCategory, setOpenCategory] = useState<string | null>(activeCategory);

  // Subgrupos recolhíveis: por padrão só fica aberto o da tela atual (ou o primeiro da categoria da tela atual).
  const [openSubs, setOpenSubs] = useState<Set<string>>(() => {
    const keys = new Set<string>();
    for (const g of groups) {
      const hit = g.subgroups.find((sg) => sg.items.some((it) => isActiveHref(pathname, it.href)));
      const pick = hit ?? (g.category === activeCategory ? g.subgroups[0] : undefined);
      if (pick) keys.add(`${g.category}::${pick.label}`);
    }
    return keys;
  });
  // Submenu flutuante (menu recolhido): categoria aberta e a posição vertical do ícone que a abriu.
  const [flyout, setFlyout] = useState<{ category: string; top: number } | null>(null);
  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelFlyoutClose() {
    if (flyoutTimer.current) { clearTimeout(flyoutTimer.current); flyoutTimer.current = null; }
  }
  function scheduleFlyoutClose() {
    cancelFlyoutClose();
    flyoutTimer.current = setTimeout(() => setFlyout(null), 200);
  }
  function openFlyout(category: string, el: HTMLElement) {
    cancelFlyoutClose();
    setFlyout({ category, top: Math.max(8, Math.round(el.getBoundingClientRect().top)) });
  }
  useEffect(() => {
    if (!flyout) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFlyout(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flyout]);

  function toggleSub(key: string) {
    setOpenSubs((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Ao ir para uma tela (menu, busca Ctrl+K, link), abre o subgrupo dela no menu.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    for (const g of groups) {
      const hit = g.subgroups.find((sg) => sg.items.some((it) => isActiveHref(pathname, it.href)));
      if (hit) {
        const key = `${g.category}::${hit.label}`;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpenSubs((cur) => (cur.has(key) ? cur : new Set(cur).add(key)));
        setOpenCategory(g.category);
        return;
      }
    }
  }, [pathname, groups]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem('sigma.sidebar.rail') === '1') setRail(true);
    } catch {}
  }, []);

  function toggleRail() {
    setRail((r) => {
      const next = !r;
      try { localStorage.setItem('sigma.sidebar.rail', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  // Tema: aplicado só enquanto o dashboard está montado. Ao sair (navegação
  // client-side para landing/login/institucional), remove data-theme para
  // voltar ao escuro fixo da marca — essas páginas não usam o script anti-flash
  // do dashboard/layout.tsx e ficariam com o data-theme "vazado" do <html>
  // compartilhado se não for limpo aqui.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sigma-theme');
      if (saved === 'light' || saved === 'system') document.documentElement.setAttribute('data-theme', saved);
    } catch {}
    return () => { document.documentElement.removeAttribute('data-theme'); };
  }, []);

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

  // Single-open: abrir uma categoria fecha a anterior; clicar na aberta fecha-a.
  function toggleCategory(name: string) {
    setOpenCategory((cur) => (cur === name ? null : name));
  }

  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'SH';

  // Trilha (breadcrumb) derivada da rota: navegação na própria tela, sem depender
  // das setas do navegador. Cada nível é clicável quando corresponde a uma página.
  const hrefLabel = useMemo(() => {
    const map: Record<string, string> = { '/dashboard': 'Painel' };
    for (const g of groups) for (const it of allItems(g)) map[it.href] = it.label;
    return map;
  }, [groups]);

  // Comandos (telas) para a paleta Ctrl/Cmd+K. Item de subgrupo carrega o
  // subgrupo no rótulo do grupo ("Financeiro › Entradas e Saídas") — ajuda a
  // achar o item certo numa categoria com muitos itens.
  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [{ label: 'Painel', href: '/dashboard', group: 'Geral' }];
    for (const g of groups) {
      for (const it of g.items) list.push({ label: it.label, href: it.href, group: g.category });
      for (const sg of g.subgroups) for (const it of sg.items) list.push({ label: it.label, href: it.href, group: `${g.category} › ${sg.label}` });
    }
    for (const c of extraCommands) if (!list.some((x) => x.href === c.href)) list.push(c);
    return list;
  }, [groups, extraCommands]);

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
    <QuickNavProvider role={role}>
    <div className="min-h-screen bg-sigma-blue-deep text-sand">
      <a
        href="#conteudo"
        className="sr-only rounded-full bg-gold px-4 py-2 text-sm font-medium text-sigma-blue-deep focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Pular para o conteúdo
      </a>
      <div className="flex">
        {open ? (
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-sigma-blue-deep/80 backdrop-blur-sm lg:hidden"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/6 bg-sigma-blue-dark/95 transition-[transform,width] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${rail ? 'lg:w-16' : ''} ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className={`flex items-center justify-between border-b border-white/5 py-5 ${rail ? 'lg:justify-center lg:px-0' : 'px-6'}`}>
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
              const isOpen = openCategory === group.category;
              const catBadge = categoryBadge(group);
              const groupId = `nav-group-${group.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

              function renderItem(item: NavItem) {
                const active = pathname === item.href;
                const Icon = NAV_ICONS[item.href] ?? Circle;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    title={rail ? item.label : undefined}
                    aria-label={item.label}
                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${rail ? 'lg:justify-center lg:px-0' : ''} ${
                      active
                        ? 'bg-gold/10 font-medium text-gold'
                        : 'text-sand/70 hover:bg-white/3 hover:text-sand'
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-gold' : 'text-sand-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                    <span className={`min-w-0 flex-1 ${rail ? 'lg:hidden' : ''}`}>{item.label}</span>
                    {item.badge ? (
                      <span
                        title={item.badge.hint}
                        aria-label={item.badge.hint}
                        className={`${badgePillClass(item.badge)} ${rail ? 'lg:absolute lg:right-1 lg:top-0.5 lg:min-w-0 lg:px-1 lg:text-[0.55rem]' : ''}`}
                      >
                        {badgeText(item.badge.count)}
                      </span>
                    ) : null}
                  </Link>
                );
              }

              // Grupo "solto" (flat): sem acordeão — os itens ficam sempre
              // visíveis, sem exigir um clique a mais pra abrir a categoria.
              // Usado só pra "Visão geral" (itens de acesso frequente por
              // qualquer papel); as demais categorias continuam em acordeão
              // single-open, senão o menu inteiro ficaria comprido demais.
              if (group.flat) {
                return (
                  <div key={group.category}>
                    <p className={`px-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-sand-dark/70 ${rail ? 'lg:hidden' : ''}`}>
                      {group.category}
                    </p>
                    <div className="mt-2 space-y-0.5">{group.items.map(renderItem)}</div>
                  </div>
                );
              }

              const CatIcon = CATEGORY_ICONS[group.category] ?? Circle;
              const catActive = allItems(group).some((it) => isActiveHref(pathname, it.href));
              return (
                <div key={group.category}>
                  {/* Menu recolhido (só desktop): um ícone por categoria; o submenu abre ao lado (flutuante). */}
                  {rail ? (
                    <button
                      type="button"
                      onMouseEnter={(e) => openFlyout(group.category, e.currentTarget)}
                      onMouseLeave={scheduleFlyoutClose}
                      onFocus={(e) => openFlyout(group.category, e.currentTarget)}
                      onClick={(e) => (flyout?.category === group.category ? setFlyout(null) : openFlyout(group.category, e.currentTarget))}
                      aria-haspopup="menu"
                      aria-expanded={flyout?.category === group.category}
                      aria-label={group.category}
                      className={`relative hidden w-full items-center justify-center rounded-lg py-2.5 transition-colors lg:flex ${catActive || flyout?.category === group.category ? 'bg-gold/10 text-gold' : 'text-sand-dark hover:bg-white/3 hover:text-sand'}`}
                    >
                      <CatIcon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                      {catBadge ? <span aria-hidden="true" className={`absolute right-2 top-1.5 h-2 w-2 rounded-full ${catBadge.tone === 'alerta' ? 'bg-rose-400' : 'bg-gold'}`} /> : null}
                    </button>
                  ) : null}
                  <div className={rail ? 'lg:hidden' : ''}>
                  <button
                    onClick={() => toggleCategory(group.category)}
                    aria-expanded={isOpen}
                    aria-controls={groupId}
                    className={`flex w-full items-center justify-between px-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-sand-dark/70 transition hover:text-sand ${rail ? 'lg:hidden' : ''}`}
                  >
                    <span>{group.category}</span>
                    <span className="flex items-center gap-2">
                      {!isOpen && catBadge ? (
                        <span title="Há itens esperando você nesta área" className={badgePillClass(catBadge)}>{badgeText(catBadge.count)}</span>
                      ) : null}
                      <svg
                        className={`h-3 w-3 text-sand-dark/50 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>
                  <div id={groupId} className={`mt-2 space-y-3 ${isOpen ? '' : 'hidden'} ${rail ? 'lg:block! lg:mt-0 lg:space-y-0.5' : ''}`}>
                      {group.items.length > 0 ? (
                        <div className="space-y-0.5">{group.items.map(renderItem)}</div>
                      ) : null}
                      {group.subgroups.map((sg) => {
                        const subKey = `${group.category}::${sg.label}`;
                        const subOpen = openSubs.has(subKey);
                        const subId = `nav-sub-${subKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                        const subBadge = subgroupBadge(sg);
                        return (
                          <div key={sg.label} className={rail ? 'lg:border-t lg:border-white/5 lg:pt-1 lg:first:border-t-0 lg:first:pt-0' : ''}>
                            <button
                              onClick={() => toggleSub(subKey)}
                              aria-expanded={subOpen}
                              aria-controls={subId}
                              className={`flex w-full items-center justify-between rounded-md px-3 pb-1 text-[0.65rem] font-medium uppercase tracking-[0.15em] text-sand-dark/60 transition hover:text-sand ${rail ? 'lg:hidden' : ''}`}
                            >
                              <span>{sg.label}</span>
                              <span className="flex items-center gap-2">
                                {!subOpen && subBadge ? <span title="Há itens esperando você aqui" className={badgePillClass(subBadge)}>{badgeText(subBadge.count)}</span> : null}
                                <svg
                                  className={`h-2.5 w-2.5 text-sand-dark/50 transition-transform duration-200 ${subOpen ? 'rotate-90' : ''}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </span>
                            </button>
                            <div id={subId} className={`space-y-0.5 ${subOpen ? '' : 'hidden'} ${rail ? 'lg:block!' : ''}`}>{sg.items.map(renderItem)}</div>
                          </div>
                        );
                      })}
                  </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="hidden border-t border-white/5 p-3 lg:block">
            <button
              onClick={toggleRail}
              title={rail ? 'Expandir menu' : 'Recolher menu'}
              aria-label={rail ? 'Expandir menu' : 'Recolher menu'}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sand-dark transition-colors hover:bg-white/3 hover:text-sand ${rail ? 'justify-center px-0' : ''}`}
            >
              {rail
                ? <PanelLeft className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                : <PanelLeftClose className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />}
              <span className={rail ? 'hidden' : ''}>Recolher menu</span>
            </button>
          </div>
        </aside>

        {/* Submenu flutuante do menu recolhido: abre ao lado do ícone da categoria (passar o mouse, focar ou clicar). */}
        {rail && flyout ? (() => {
          const g = groups.find((x) => x.category === flyout.category);
          if (!g) return null;
          const link = (it: NavItem) => {
            const Icon = NAV_ICONS[it.href] ?? Circle;
            const active = isActiveHref(pathname, it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                role="menuitem"
                onClick={() => setFlyout(null)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? 'bg-gold/10 font-medium text-gold' : 'text-sand/80 hover:bg-white/5 hover:text-sand-light'}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-gold' : 'text-sand-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                <span className="min-w-0 flex-1">{it.label}</span>
                {it.badge ? <span title={it.badge.hint} aria-label={it.badge.hint} className={badgePillClass(it.badge)}>{badgeText(it.badge.count)}</span> : null}
              </Link>
            );
          };
          return (
            <div
              role="menu"
              aria-label={g.category}
              onMouseEnter={cancelFlyoutClose}
              onMouseLeave={scheduleFlyoutClose}
              style={{ top: flyout.top, maxHeight: `calc(100vh - ${flyout.top}px - 16px)` }}
              className="fixed left-16 z-50 ml-1 hidden w-72 overflow-y-auto rounded-xl border border-white/10 bg-sigma-card p-2 lg:block"
            >
              <p className="px-3 pb-1 pt-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-gold/90">{g.category}</p>
              {g.items.map(link)}
              {g.subgroups.map((sg) => (
                <div key={sg.label} className="mt-1 border-t border-white/5 pt-1">
                  <p className="px-3 pb-1 pt-1.5 text-[0.6rem] font-medium uppercase tracking-[0.15em] text-sand-dark/60">{sg.label}</p>
                  {sg.items.map(link)}
                </div>
              ))}
            </div>
          );
        })() : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-0">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/6 bg-sigma-blue-deep/85 px-5 py-3.5 backdrop-blur-sm lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setOpen(true)}
                className="flex items-center justify-center rounded-lg border border-white/8 px-2.5 py-1.5 text-sand/70 transition hover:border-white/12 hover:text-sand lg:hidden"
                aria-label="Abrir menu"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0">
                <p className="text-[0.6rem] uppercase tracking-[0.25em] text-sand-dark/60">Loja maçônica</p>
                <p className="truncate text-base font-semibold text-sand-light">{lodgeName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <QuickNavToggle />
              <button
                onClick={() => window.dispatchEvent(new Event('sigma:open-cmdk'))}
                className="hidden items-center gap-2 rounded-full border border-white/8 px-3 py-1.5 text-xs text-sand-dark transition hover:border-gold/40 hover:text-sand sm:flex"
                aria-label="Buscar (Ctrl ou Cmd + K)"
                title="Buscar telas e ações"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
                <span className="hidden md:inline">Buscar</span>
                <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 font-mono text-[0.6rem] md:inline">⌘K</kbd>
              </button>
              <Link href="/dashboard/minha-conta" className="hidden text-right transition hover:opacity-80 sm:block" title="Minha conta">
                <p className="text-sm font-medium text-sand-light">{userName}</p>
                <p className="text-xs text-gold/70">{ROLE_LABEL[role] ?? role}</p>
              </Link>
              <Link
                href="/dashboard/minha-conta"
                aria-label="Minha conta"
                title="Minha conta"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-xs font-semibold text-gold transition hover:bg-gold/20 sm:h-9 sm:w-9"
              >
                {initials}
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="rounded-full border border-white/8 px-3.5 py-1.5 text-xs text-sand/60 transition hover:border-rose-500/30 hover:text-rose-300"
              >
                Sair
              </button>
            </div>
          </header>

          {crumbs.length > 1 ? (
            <nav aria-label="Trilha de navegação" className="border-b border-white/6 bg-sigma-blue-deep/60 px-5 py-2.5 lg:px-8">
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

          <div className="fio-de-prumo mx-5 lg:mx-8" />
          <SiblingNav groups={groups} />
          <div id="conteudo" tabIndex={-1} className="flex-1 bg-sigma-app outline-none"><SessionGuard /><ConfirmProvider>{candidateBlocked ? null : children}</ConfirmProvider></div>
        </div>
      </div>
      <CommandPalette commands={commands} />
      {art002DaysOverdue != null ? <Art002Alert daysOverdue={art002DaysOverdue} /> : null}
    </div>
    </QuickNavProvider>
  );
}
