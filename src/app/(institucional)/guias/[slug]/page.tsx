import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LegalDoc, Section } from '@/components/legal-doc';
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

      {guide.blocks.map((b) => (
        <Section key={b.h} title={b.h}>
          {b.p?.map((t) => <p key={t}>{t}</p>)}
          {b.ol ? <ol className="list-decimal space-y-2 pl-6">{b.ol.map((t) => <li key={t}>{t}</li>)}</ol> : null}
          {b.ul ? <ul className="list-disc space-y-2 pl-6">{b.ul.map((t) => <li key={t}>{t}</li>)}</ul> : null}
          {b.table ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm [&_td]:border-b [&_td]:border-white/6 [&_td]:px-3 [&_td]:py-2 [&_th]:border-b [&_th]:border-white/10 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-sand-light">
                <thead><tr>{b.table.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                <tbody>{b.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : null}
        </Section>
      ))}

      <section className="rounded-xl border border-gold/25 bg-gold/5 p-6">
        <h2 className="text-lg font-semibold text-sand-light">Como o Sigma Horus ajuda</h2>
        <p className="mt-2 text-base leading-7 text-sand">{guide.cta}</p>
        <Link href="/#planos" className="mt-4 inline-flex rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-sigma-blue-deep transition-colors hover:bg-gold-light">
          Testar 10 dias grátis
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
