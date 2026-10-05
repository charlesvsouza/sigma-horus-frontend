import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GuideBlocks } from '@/components/guide-blocks';
import { LegalDoc } from '@/components/legal-doc';
import { GUIDES, getGuide } from '@/lib/guides';
import { jsonLdString, SITE_URL } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  return {
    title: guide.short,
    description: guide.description,
    alternates: { canonical: `/guias/${guide.slug}` },
    openGraph: { type: 'article', title: guide.title, description: guide.description, url: `/guias/${guide.slug}`, modifiedTime: guide.updatedAt },
  };
}

const br = (iso: string) => iso.split('-').reverse().join('/');

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    inLanguage: 'pt-BR',
    datePublished: guide.updatedAt,
    dateModified: guide.updatedAt,
    mainEntityOfPage: `${SITE_URL}/guias/${guide.slug}`,
    author: { '@type': 'Organization', name: 'Sigma Horus', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Sigma Horus', logo: { '@type': 'ImageObject', url: `${SITE_URL}/sigmahorus_ouro.png` } },
  };
  const related = GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <LegalDoc eyebrow="Guia da tesouraria" title={guide.title} updatedAt={br(guide.updatedAt)} intro={guide.intro}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />

      <GuideBlocks blocks={guide.blocks} />

      <section className="rounded-xl border border-gold/25 bg-gold/5 p-6">
        <h2 className="text-lg font-semibold text-sand-light">Como o Sigma Horus ajuda</h2>
        <p className="mt-2 text-base leading-7 text-sand">{guide.cta}</p>
        <Link href="/#planos" className="mt-4 inline-flex rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-sigma-blue-deep transition-colors hover:bg-gold-light">
          Testar 10 dias (cartão exigido)
        </Link>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-sand-light">Outros guias</h2>
        <ul className="mt-3 space-y-2">
          {related.map((g) => (
            <li key={g.slug}><Link href={`/guias/${g.slug}`} className="text-gold/90 hover:text-gold">{g.short}</Link></li>
          ))}
          <li><Link href="/guias" className="text-sand-dark hover:text-sand">Todos os guias</Link></li>
        </ul>
      </section>
    </LegalDoc>
  );
}
