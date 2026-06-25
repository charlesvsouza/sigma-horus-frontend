import Link from 'next/link';
import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside className="border-b border-white/10 bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold text-amber-300">Sigma Horus</div>
          <nav className="flex flex-wrap gap-4 text-sm text-slate-300">
            <Link href="/dashboard" className="transition hover:text-white">Visão geral</Link>
            <Link href="/dashboard/cadastros" className="transition hover:text-white">Cadastros</Link>
            <Link href="/dashboard/membros" className="transition hover:text-white">Membros</Link>
            <Link href="/dashboard/contas" className="transition hover:text-white">Contas</Link>
            <Link href="/dashboard/cobrancas" className="transition hover:text-white">Cobranças</Link>
          </nav>
        </div>
      </aside>
      {children}
    </div>
  );
}
