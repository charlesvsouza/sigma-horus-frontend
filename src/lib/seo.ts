import { PLANS } from '@/lib/plans';

// Dados estruturados (schema.org) da landing: ajudam o Google a entender o que é o produto, os planos e as perguntas.
// A lista de perguntas é a mesma da página (fonte única) — o que está no JSON-LD é exatamente o que o visitante lê.

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigmahorus.com.br').replace(/\/+$/, '');

export function landingJsonLd(faq: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Sigma Horus',
        url: SITE_URL,
        logo: `${SITE_URL}/sigmahorus_ouro.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'Sigma Horus',
        inLanguage: 'pt-BR',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Sigma Horus',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        inLanguage: 'pt-BR',
        url: SITE_URL,
        description: 'Sistema de gestão para loja maçônica: tesouraria com Pix, portal do irmão, secretaria, chancelaria e hospitalaria.',
        publisher: { '@id': `${SITE_URL}/#organization` },
        offers: Object.values(PLANS).map((p) => ({
          '@type': 'Offer',
          name: `Plano ${p.name}`,
          description: p.description,
          price: (p.price / 100).toFixed(2),
          priceCurrency: 'BRL',
          url: `${SITE_URL}/#planos`,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };
}

/** JSON seguro para dentro de <script>: escapa "<" para que nenhum texto feche a tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
