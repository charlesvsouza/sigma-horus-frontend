import Link from 'next/link';
import { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';

const navItems = [
  { href: '/dashboard', label: 'Visão geral', roles: ['admin', 'venerable', 'treasurer', 'secretary', 'member'] },
  { href: '/dashboard/portal', label: 'Meu portal', roles: ['admin', 'venerable', 'treasurer', 'secretary', 'member'] },
  { href: '/dashboard/membros', label: 'Membros', roles: ['admin', 'venerable', 'secretary', 'treasurer'] },
  { href: '/dashboard/documentos', label: 'Documentos', roles: ['admin', 'venerable', 'secretary', 'treasurer'] },
  { href: '/dashboard/comunicacao', label: 'Comunicação', roles: ['admin', 'venerable', 'secretary', 'treasurer'] },
  { href: '/dashboard/cargos', label: 'Cargos', roles: ['admin', 'venerable', 'secretary'] },
  { href: '/dashboard/veneralato', label: 'Veneralato', roles: ['admin', 'venerable', 'secretary'] },
  { href: '/dashboard/contas', label: 'Contas', roles: ['admin', 'venerable', 'treasurer'] },
  { href: '/dashboard/cobrancas', label: 'Cobranças', roles: ['admin', 'treasurer'] },
  { href: '/dashboard/pagamentos', label: 'Pagamentos', roles: ['admin', 'treasurer'] },
  { href: '/dashboard/sessoes', label: 'Sessões', roles: ['admin', 'venerable', 'secretary'] },
  { href: '/dashboard/relatorios', label: 'Relatórios', roles: ['admin', 'venerable', 'treasurer', 'secretary'] },
  { href: '/dashboard/integracoes', label: 'Integrações', roles: ['admin'] },
  { href: '/dashboard/auditoria', label: 'Auditoria', roles: ['admin'] },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = (session?.user?.role ?? 'member').toLowerCase();

  let subscriptionBanner = null;
  if (lodgeId) {
    const sub = await withTenant(String(lodgeId), (db) =>
      db.subscription.findUnique({
        where: { lodgeId: String(lodgeId) },
        select: { status: true },
      }),
    );
    if (!sub || sub.status !== 'active') {
      subscriptionBanner = (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 text-center text-sm text-amber-200">
          Sua loja ainda não possui uma assinatura ativa.{' '}
          <a href="/#planos" className="underline hover:text-amber-100">Escolher plano</a>
        </div>
      );
    }
  }

  const visibleNav = navItems.filter((item) => item.roles.includes(role));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {subscriptionBanner}
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="w-full border-b border-white/10 bg-slate-900/80 p-6 lg:w-72 lg:border-b-0 lg:border-r lg:py-8">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.35em] text-amber-400">Sigma Horus</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Painel da loja</h2>
            <p className="mt-2 text-sm text-slate-400">{session?.user?.name ?? 'Usuário'}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-500">{role}</p>
          </div>
          <nav className="space-y-2">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center rounded-2xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
