import Link from 'next/link';
import type { ReactNode } from 'react';
import { INSTITUTIONAL_LINKS } from '@/components/legal-doc';

export default function InstitucionalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/[6%] bg-sigma-blue-deep/85 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-sm font-semibold tracking-[0.2em] text-gold">SIGMA HORUS</Link>
          <div className="hidden items-center gap-5 md:flex">
            {INSTITUTIONAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-sand-dark transition-colors hover:text-sand-light">
                {l.label}
              </Link>
            ))}
          </div>
          <Link href="/login" className="rounded-full border border-gold/40 px-4 py-1.5 text-sm font-medium text-gold/80 transition-all hover:border-gold/60 hover:text-gold">
            Entrar
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
