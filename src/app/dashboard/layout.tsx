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
  let subscriptionActive = true;
  if (lodgeId) {
    const data = await withTenant(String(lodgeId), async (db) => {
      const [lodge, sub] = await Promise.all([
        db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true } }),
        db.subscription.findUnique({ where: { lodgeId: String(lodgeId) }, select: { status: true } }),
      ]);
      return { lodge, sub };
    });
    if (data.lodge?.name) lodgeName = data.lodge.name;
    subscriptionActive = data.sub?.status === 'active';
  }

  const groups = NAV
    .map((g) => ({ category: g.category, items: g.items.filter((i) => i.roles.includes(role)).map(({ href, label }) => ({ href, label })) }))
    .filter((g) => g.items.length > 0);

  return (
    <DashboardShell groups={groups} lodgeName={lodgeName} userName={session?.user?.name ?? 'Usuário'} role={role}>
      {!subscriptionActive ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 text-center text-sm text-amber-200">
          Sua loja ainda não possui uma assinatura ativa.{' '}
          <a href="/#planos" className="underline hover:text-amber-100">Escolher plano</a>
        </div>
      ) : null}
      {children}
    </DashboardShell>
  );
}
