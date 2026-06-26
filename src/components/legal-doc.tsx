import Link from 'next/link';
import type { ReactNode } from 'react';

export const INSTITUTIONAL_LINKS = [
  { href: '/sobre', label: 'Sobre' },
  { href: '/termos', label: 'Termos de Uso' },
  { href: '/privacidade', label: 'Privacidade & LGPD' },
  { href: '/compliance', label: 'Compliance & Transparência' },
];

/**
 * Moldura de leitura com formatação acadêmica para documentos institucionais
 * e legais (Sobre, Termos, Privacidade, Compliance). Coluna central estreita
 * (~65-75ch), hierarquia tipográfica clara e índice opcional.
 */
export function LegalDoc({
  eyebrow,
  title,
  updatedAt,
  intro,
  draftNotice = false,
  children,
}: {
  eyebrow?: string;
  title: string;
  updatedAt?: string;
  intro?: ReactNode;
  draftNotice?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <header className="border-b border-white/[6%] pb-8">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">{eyebrow}</p>
        ) : null}
        <h1 className="mt-3 text-3xl font-bold leading-tight text-sand-light lg:text-4xl">{title}</h1>
        {updatedAt ? (
          <p className="mt-3 text-sm text-sand-dark">Última atualização: {updatedAt}</p>
        ) : null}
        {intro ? <div className="mt-5 text-base leading-7 text-sand">{intro}</div> : null}
        {draftNotice ? (
          <p className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <strong>Minuta para revisão jurídica.</strong> Este texto é um rascunho de referência e deve ser
            validado por um advogado antes da publicação definitiva, considerando a realidade da sua operação.
          </p>
        ) : null}
      </header>

      <div className="legal-body mt-8 space-y-8">{children}</div>

      <footer className="mt-14 border-t border-white/[6%] pt-8 text-sm text-sand-dark">
        <p>Sigma Horus — a tesouraria da sua loja no prumo.</p>
        <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {INSTITUTIONAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-gold/80 transition-colors hover:text-gold">
              {l.label}
            </Link>
          ))}
          <Link href="/" className="transition-colors hover:text-sand">Início</Link>
        </nav>
      </footer>
    </article>
  );
}

/** Seção numerada com título e corpo, no estilo de documento acadêmico. */
export function Section({ id, n, title, children }: { id?: string; n?: number | string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold text-sand-light">
        {n != null ? <span className="mr-2 text-gold">{n}.</span> : null}
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-base leading-7 text-sand">{children}</div>
    </section>
  );
}
