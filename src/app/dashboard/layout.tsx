import Link from 'next/link';
import { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

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
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 text-center text-sm text-amber-200">
          Sua loja ainda não possui uma assinatura ativa.{' '}
          <a href="/#planos" className="underline hover:text-amber-100">Escolher plano</a>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {subscriptionBanner}
      <aside className="border-b border-white/10 bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold text-amber-300">Sigma Horus</div>
          <nav className="flex flex-wrap gap-4 text-sm text-slate-300">
            <Link href="/dashboard" className="transition hover:text-white">Visão geral</Link>
            <Link href="/dashboard/cadastros" className="transition hover:text-white">Cadastros</Link>
            <Link href="/dashboard/membros" className="transition hover:text-white">Membros</Link>
            <Link href="/dashboard/cargos" className="transition hover:text-white">Cargos</Link>
            <Link href="/dashboard/veneralato" className="transition hover:text-white">Veneralato</Link>
            <Link href="/dashboard/contas" className="transition hover:text-white">Contas</Link>
            <Link href="/dashboard/cobrancas" className="transition hover:text-white">Cobranças</Link>
            <Link href="/dashboard/pagamentos" className="transition hover:text-white">Pagamentos</Link>
            <Link href="/dashboard/sessoes" className="transition hover:text-white">Sessões</Link>
            <Link href="/dashboard/relatorios" className="transition hover:text-white">Relatórios</Link>
            <Link href="/dashboard/integracoes" className="transition hover:text-white">Integrações</Link>
            <Link href="/dashboard/auditoria" className="transition hover:text-white">Auditoria</Link>
          </nav>
        </div>
      </aside>
      {children}
    </div>
  );
}
