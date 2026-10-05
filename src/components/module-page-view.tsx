import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GuideBlocks } from '@/components/guide-blocks';
import { LegalDoc, Section } from '@/components/legal-doc';
import { getModulePage, MODULE_PAGES } from '@/lib/module-pages';
import { jsonLdString, SITE_URL } from '@/lib/seo';

const br = (iso: string) => iso.split('-').reverse().join('/');

export function moduleMetadata(slug: string): Metadata {
  const m = getModulePage(slug);
  if (!m) return {};
  return {
    title: m.short,
    description: m.description,
    alternates: { canonical: `/${m.slug}` },
    openGraph: { type: 'website', title: m.short, description: m.description, url: `/${m.slug}` },
  };
}

/** Página pública de um módulo: H1 com a busca-alvo, texto, FAQ (com FAQPage em JSON-LD), CTA e links para os outros módulos. */
export function ModulePageView({ slug }: { slug: string }) {
  const m = getModulePage(slug);
  if (!m) notFound();

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: m.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    url: `${SITE_URL}/${m.slug}`,
    inLanguage: 'pt-BR',
  };
  const others = MODULE_PAGES.filter((o) => o.slug !== m.slug);

  return (
    <LegalDoc eyebrow="Módulo do Sigma Horus" title={m.h1} updatedAt={br(m.updatedAt)} intro={m.intro}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />

      <GuideBlocks blocks={m.blocks} />

      <Section title="Perguntas frequentes">
        <dl className="space-y-4">
          {m.faq.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold text-sand-light">{f.q}</dt>
              <dd className="mt-1">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <section className="rounded-xl border border-gold/25 bg-gold/5 p-6">
        <h2 className="text-lg font-semibold text-sand-light">Conheça na prática</h2>
        <p className="mt-2 text-base leading-7 text-sand">Teste o Sigma Horus por 10 dias, com todos os módulos do plano escolhido. O cartão é cadastrado no início e só é cobrado ao fim do teste.</p>
        <Link href="/#planos" className="mt-4 inline-flex rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-sigma-blue-deep transition-colors hover:bg-gold-light">
          Ver planos e testar 10 dias
        </Link>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-sand-light">Outros módulos</h2>
        <ul className="mt-3 space-y-2">
          {others.map((o) => (
            <li key={o.slug}><Link href={`/${o.slug}`} className="text-gold/90 hover:text-gold">{o.linkLabel}</Link></li>
          ))}
          <li><Link href="/guias" className="text-sand-dark hover:text-sand">Guias da tesouraria</Link></li>
        </ul>
      </section>
    </LegalDoc>
  );
}
