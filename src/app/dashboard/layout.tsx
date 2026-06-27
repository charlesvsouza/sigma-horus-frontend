import { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import DashboardShell from './DashboardShell';

interface NavEntry { href: string; label: string; roles: string[]; }
interface NavGroupDef { category: string; items: NavEntry[]; }

const NAV: NavGroupDef[] = [
  {
    category: 'Visão geral',
    items: [
      { href: '/dashboard', label: 'Visão geral', roles: ['admin', 'venerable', 'treasurer', 'secretary', 'member'] },
      { href: '/dashboard/portal', label: 'Meu portal', roles: ['admin', 'venerable', 'treasurer', 'secretary', 'member'] },
      { href: '/manual', label: 'Manual & ajuda', roles: ['admin', 'venerable', 'treasurer', 'secretary', 'member'] },
    ],
  },
  {
    category: 'Loja & cadastros',
    items: [
      { href: '/dashboard/membros', label: 'Membros', roles: ['admin', 'venerable', 'secretary', 'treasurer'] },
      { href: '/dashboard/cadastros', label: 'Cadastros mestre', roles: ['admin', 'venerable', 'secretary'] },
      { href: '/dashboard/cargos', label: 'Cargos', roles: ['admin', 'venerable', 'secretary'] },
      { href: '/dashboard/veneralato', label: 'Veneralato', roles: ['admin', 'venerable', 'secretary'] },
    ],
  },
  {
    category: 'Financeiro',
    items: [
      { href: '/dashboard/contas', label: 'Contas', roles: ['admin', 'venerable', 'treasurer'] },
      { href: '/dashboard/cobrancas', label: 'Cobranças', roles: ['admin', 'treasurer'] },
      { href: '/dashboard/pagamentos', label: 'Pagamentos', roles: ['admin', 'treasurer'] },
      { href: '/dashboard/relatorios', label: 'Relatórios', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
      { href: '/dashboard/relatorios/fechamento', label: 'Fechamento', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
    ],
  },
  {
    category: 'Atividades',
    items: [
      { href: '/dashboard/sessoes', label: 'Sessões', roles: ['admin', 'venerable', 'secretary'] },
      { href: '/dashboard/documentos', label: 'Documentos', roles: ['admin', 'venerable', 'secretary', 'treasurer'] },
      { href: '/dashboard/comunicacao', label: 'Comunicação', roles: ['admin', 'venerable', 'secretary', 'treasurer'] },
    ],
  },
  {
    category: 'Administração',
    items: [
      { href: '/dashboard/configuracoes', label: 'Configurações da loja', roles: ['admin'] },
      { href: '/dashboard/assinatura', label: 'Assinatura', roles: ['admin'] },
      { href: '/dashboard/integracoes', label: 'Integrações', roles: ['admin'] },
      { href: '/dashboard/auditoria', label: 'Auditoria', roles: ['admin'] },
    ],
  },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = (session?.user?.role ?? 'member').toLowerCase();

  let lodgeName = 'Minha loja';
  let sub: {
    status: string;
    plan: string;
    trialEndsAt: Date | null;
    pendingPlan: string | null;
    pendingPlanEffectiveAt: Date | null;
  } | null = null;
  if (lodgeId) {
    const data = await withTenant(String(lodgeId), async (db) => {
      const [lodge, subscription] = await Promise.all([
        db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true } }),
        db.subscription.findUnique({
          where: { lodgeId: String(lodgeId) },
          select: { status: true, plan: true, trialEndsAt: true, pendingPlan: true, pendingPlanEffectiveAt: true },
        }),
      ]);
      return { lodge, subscription };
    });
    if (data.lodge?.name) lodgeName = data.lodge.name;
    sub = data.subscription;
  }

  const now = Date.now();
  const trialEnds = sub?.trialEndsAt ? sub.trialEndsAt.getTime() : null;
  const trialDaysLeft = trialEnds ? Math.ceil((trialEnds - now) / (24 * 60 * 60 * 1000)) : 0;
  const isTrialing = sub?.status === 'trialing' && trialEnds !== null && trialEnds > now;
  const isActive = sub?.status === 'active';
  const trialExpired = sub?.status === 'trialing' && trialEnds !== null && trialEnds <= now;
  const blocked = !isActive && !isTrialing; // inativo, trial expirado, etc.

  const fmtDate = (d: Date | null) =>
    d ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d) : '';

  const groups = NAV
    .map((g) => ({ category: g.category, items: g.items.filter((i) => i.roles.includes(role)).map(({ href, label }) => ({ href, label })) }))
    .filter((g) => g.items.length > 0);

  return (
    <DashboardShell groups={groups} lodgeName={lodgeName} userName={session?.user?.name ?? 'Usuário'} role={role}>
      {blocked ? (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-6 py-3 text-center text-sm text-rose-200">
          {trialExpired
            ? 'Seu período de teste terminou. Assine um plano para continuar usando o Sigma Horus.'
            : 'Sua loja não possui uma assinatura ativa.'}{' '}
          <a href="/dashboard/assinatura" className="font-medium underline hover:text-rose-100">Assinar agora</a>
        </div>
      ) : isTrialing ? (
        <div className="border-b border-gold/30 bg-gold/10 px-6 py-3 text-center text-sm text-gold">
          Período de teste: {trialDaysLeft} {trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'}.{' '}
          <a href="/dashboard/assinatura" className="font-medium underline hover:text-gold-light">Escolher plano</a>
        </div>
      ) : isActive && sub?.pendingPlan ? (
        <div className="border-b border-sky-500/30 bg-sky-500/10 px-6 py-3 text-center text-sm text-sky-200">
          Downgrade agendado para {fmtDate(sub.pendingPlanEffectiveAt)}. Você mantém o plano atual até lá.
        </div>
      ) : null}
      {children}
    </DashboardShell>
  );
}
