'use client';

import Link from 'next/link';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { brl } from '@/lib/currency';
import { canManageDegreeFees } from '@/lib/degree-fee';
import { MASKED_DONOR_NAME } from '@/lib/donor-mask';
import { formatDateOnly } from '@/lib/date-only';

// Navegação rápida (beta): barra de telas irmãs + painel lateral do irmão. Opt-in POR PESSOA (localStorage), desligada por
// padrão: quem não ligou vê o sistema exatamente como era. Para voltar atrás, basta desligar o botão "Navegação rápida"
// no topo (ou apagar este arquivo e os 3 pontos de uso). Nada aqui grava dado: o painel só lê e leva a telas que já existem.

const KEY = 'sigma.quicknav';
const PENDING_PREVIEW = 5;

interface QuickNavCtx {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  openMember: (id: string) => void;
}
const Ctx = createContext<QuickNavCtx>({ enabled: false, setEnabled: () => {}, openMember: () => {} });
export const useQuickNav = () => useContext(Ctx);

export function QuickNavProvider({ role, children }: { role: string; children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(KEY) === '1') setEnabledState(true);
    } catch {}
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    if (!on) setOpenId(null);
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
  }, []);

  const openMember = useCallback((id: string) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpenId(id);
  }, []);

  const close = useCallback(() => {
    setOpenId(null);
    openerRef.current?.focus();
  }, []);

  return (
    <Ctx.Provider value={{ enabled, setEnabled, openMember }}>
      {children}
      {enabled && openId ? <MemberPanel key={openId} id={openId} role={role} onClose={close} /> : null}
    </Ctx.Provider>
  );
}

/** Botão do topo que liga/desliga a navegação rápida (por pessoa). */
export function QuickNavToggle() {
  const { enabled, setEnabled } = useQuickNav();
  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      aria-pressed={enabled}
      aria-label={enabled ? 'Navegação rápida ligada' : 'Navegação rápida desligada'}
      title={enabled ? 'Desligar a navegação rápida (volta ao menu de sempre)' : 'Ligar a navegação rápida (beta): barra de telas irmãs e painel do irmão'}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${enabled ? 'border-gold/60 bg-gold/10 text-gold' : 'border-white/8 text-sand-dark hover:border-gold/40 hover:text-sand'}`}
    >
      <span aria-hidden="true">⚡</span>
      <span className="hidden md:inline">Navegação rápida</span>
      <span className="hidden text-[0.6rem] uppercase tracking-wider opacity-70 md:inline">{enabled ? 'ligada' : 'beta'}</span>
    </button>
  );
}

interface NavItem { href: string; label: string }
interface NavSubgroup { label: string; items: NavItem[] }
interface NavGroup { category: string; items: NavItem[]; subgroups: NavSubgroup[] }

/** Telas do mesmo assunto (o subgrupo do menu em que a tela atual está), para trocar sem abrir o menu. */
export function SiblingNav({ groups }: { groups: NavGroup[] }) {
  const { enabled } = useQuickNav();
  const pathname = usePathname() ?? '';
  if (!enabled) return null;
  let found: NavSubgroup | null = null;
  let best = -1;
  for (const g of groups) for (const sg of g.subgroups) for (const it of sg.items) {
    const hit = pathname === it.href || (it.href !== '/dashboard' && pathname.startsWith(`${it.href}/`));
    if (hit && it.href.length > best) { best = it.href.length; found = sg; }
  }
  if (!found || found.items.length < 2) return null;
  const current = found.items.filter((it) => pathname === it.href || pathname.startsWith(`${it.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label={`Telas de ${found.label}`} className="mx-5 mt-4 flex items-center gap-1 overflow-x-auto rounded-xl border border-white/6 bg-sigma-card px-3 lg:mx-8">
      <span className="shrink-0 pr-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-sand-dark">{found.label}</span>
      {found.items.map((it) => {
        const active = it.href === current;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm transition-colors ${active ? 'border-gold text-sand-light font-medium' : 'border-transparent text-sand-dark hover:text-sand-light'}`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Nome do irmão: com a navegação rápida ligada vira botão que abre o painel; desligada, é texto puro (como sempre foi). */
export function MemberLink({ id, name, className = '' }: { id: string | null | undefined; name: string; className?: string }) {
  const { enabled, openMember } = useQuickNav();
  // Nome mascarado (doador do Tronco para quem não vê a identidade): nunca vira atalho para o painel.
  if (!enabled || !id || name === MASKED_DONOR_NAME) return <>{name}</>;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openMember(id); }}
      title="Abrir o painel do irmão"
      className={`inline cursor-pointer text-left underline decoration-gold/50 underline-offset-2 transition-colors hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${className}`}
    >
      {name}
    </button>
  );
}

interface QuickData {
  id: string; name: string; degree: string | null; statusLabel: string;
  access: { contact: boolean; financial: boolean };
  contact: { email: string | null; phone: string | null } | null;
  financial: null | {
    debt: number; overdue: number; credit: number;
    pending: { id: string; title: string; dueDate: string; balance: number; overdue: boolean; daysOverdue: number }[];
    payments: { id: string; title: string; amount: number; paidAt: string; method: string }[];
    plans: { id: string; label: string; totalAmount: number; downPayment: number | null; installments: number; cotaCount: number; paid: number; open: number; situation: string }[];
    block: { id: string; status: string } | null;
    art002: { daysOverdue: number; amount: number } | null;
  };
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center justify-between text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-sand-dark"><span>{title}</span>{aside}</h3>
      {children}
    </section>
  );
}

function MemberPanel({ id, role, onClose }: { id: string; role: string; onClose: () => void }) {
  const [data, setData] = useState<QuickData | null>(null);
  const [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/members/${id}/quick`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) setError(body.error ?? 'Não foi possível abrir o painel.');
        else setData(body as QuickData);
      })
      .catch(() => { if (alive) setError('Não foi possível abrir o painel.'); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const f = data?.financial ?? null;
  const manage = canManageDegreeFees(role);
  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-name"
        className="absolute inset-x-0 bottom-0 flex h-[88%] flex-col rounded-t-2xl border border-white/8 bg-sigma-card shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[26rem] sm:rounded-none sm:border-y-0 sm:border-r-0"
      >
        <header className="flex items-start gap-3 border-b border-white/6 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="quick-name" className="font-display text-lg font-semibold text-sand-light">{data?.name ?? 'Carregando…'}</h2>
            {data ? (
              <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                {data.degree ? <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-sand-dark">{data.degree}</span> : null}
                <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-sand-dark">{data.statusLabel}</span>
                {f?.art002 ? <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-amber-300">Art. 002 · informativo</span> : null}
                {f?.block ? <span className="rounded-full bg-rose-400/15 px-2.5 py-0.5 text-rose-300">{f.block.status === 'settled' ? 'Acordo quitado' : 'Bloqueado — acordo'}</span> : null}
              </p>
            ) : null}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar painel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-sand transition hover:border-gold/40">✕</button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm text-sand">
          {error ? <p className="text-rose-300">{error}</p> : null}
          {!data && !error ? <p className="text-sand-dark">Carregando…</p> : null}

          {f ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-white/8 bg-sigma-blue-deep/50 px-3 py-2"><p className="text-[0.6rem] uppercase tracking-wider text-sand-dark">Saldo devedor</p><p className="mt-0.5 font-semibold tabular-nums text-sand-light">{brl(f.debt)}</p></div>
                <div className="rounded-lg border border-white/8 bg-sigma-blue-deep/50 px-3 py-2"><p className="text-[0.6rem] uppercase tracking-wider text-sand-dark">Vencido</p><p className={`mt-0.5 font-semibold tabular-nums ${f.overdue > 0 ? 'text-rose-300' : 'text-sand-light'}`}>{brl(f.overdue)}</p></div>
                <div className="rounded-lg border border-white/8 bg-sigma-blue-deep/50 px-3 py-2"><p className="text-[0.6rem] uppercase tracking-wider text-sand-dark">Crédito</p><p className="mt-0.5 font-semibold tabular-nums text-sand-light">{brl(f.credit)}</p></div>
              </div>

              <Section title="Pendências" aside={<span>{f.pending.length}</span>}>
                {f.pending.length === 0 ? <p className="text-sand-dark">Nada em aberto.</p> : (
                  <ul className="divide-y divide-white/5">
                    {(showAll ? f.pending : f.pending.slice(0, PENDING_PREVIEW)).map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0"><p className="truncate font-medium text-sand-light">{p.title}</p><p className={`text-xs ${p.overdue ? 'text-rose-300' : 'text-sand-dark'}`}>{p.overdue ? `Vencida há ${p.daysOverdue} ${p.daysOverdue === 1 ? 'dia' : 'dias'}` : `Vence em ${formatDateOnly(p.dueDate)}`}</p></div>
                        <span className="shrink-0 tabular-nums text-sand-light">{brl(p.balance)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {f.pending.length > PENDING_PREVIEW ? (
                  <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs font-medium text-gold underline underline-offset-2 hover:text-gold-light">
                    {showAll ? 'Mostrar menos' : `Mostrar as outras ${f.pending.length - PENDING_PREVIEW}`}
                  </button>
                ) : null}
              </Section>

              {f.plans.length > 0 ? (
                <Section title="Plano de taxa">
                  <ul className="space-y-2">
                    {f.plans.map((p) => (
                      <li key={p.id} className="rounded-lg border border-white/8 px-3 py-2">
                        <p className="font-medium text-sand-light">{p.label}</p>
                        <p className="text-xs text-sand-dark">{brl(p.totalAmount)}{p.downPayment ? ` · entrada de ${brl(p.downPayment)} + ${p.installments} ${p.installments === 1 ? 'parcela' : 'parcelas'}` : p.cotaCount > 1 ? ` em ${p.cotaCount} cotas` : ' à vista'} · pago {brl(p.paid)} · falta {brl(p.open)}</p>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              <Section title="Últimos pagamentos">
                {f.payments.length === 0 ? <p className="text-sand-dark">Nenhum pagamento registrado.</p> : (
                  <ul className="divide-y divide-white/5">
                    {f.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0"><p className="truncate text-sand-light">{p.title}</p><p className="text-xs text-sand-dark">{formatDateOnly(p.paidAt)}</p></div>
                        <span className="shrink-0 tabular-nums text-sand-light">{brl(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          ) : null}

          {data?.contact ? (
            <Section title="Contato">
              <p>{data.contact.phone ?? <span className="text-sand-dark">Sem telefone</span>}</p>
              <p className="break-all">{data.contact.email ?? <span className="text-sand-dark">Sem e-mail</span>}</p>
            </Section>
          ) : null}
          {data && !data.access.financial ? <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-sand-dark">A situação financeira não aparece para o seu cargo.</p> : null}
        </div>

        {data && f ? (
          <footer className="flex flex-wrap gap-2 border-t border-white/6 bg-sigma-blue-deep/40 px-5 py-3 text-xs">
            <Link onClick={onClose} href={`/dashboard/relatorios/historico-pagamentos?memberId=${data.id}`} className="rounded-full border border-gold/40 px-3.5 py-2 font-medium text-gold hover:text-gold-light">Histórico de pagamentos</Link>
            <Link onClick={onClose} href={`/dashboard/relatorios/declaracao-regularidade?memberId=${data.id}`} className="rounded-full border border-gold/40 px-3.5 py-2 font-medium text-gold hover:text-gold-light">Declaração de regularidade</Link>
            {manage ? <Link onClick={onClose} href={`/dashboard/taxas-de-grau?membro=${data.id}`} className="rounded-full border border-gold/40 px-3.5 py-2 font-medium text-gold hover:text-gold-light">Nova taxa de grau</Link> : null}
            {manage && f.block ? <Link onClick={onClose} href="/dashboard/acordos" className="rounded-full border border-gold/40 px-3.5 py-2 font-medium text-gold hover:text-gold-light">Ver acordo</Link> : null}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
