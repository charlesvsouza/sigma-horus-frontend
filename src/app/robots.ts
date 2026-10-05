import type { MetadataRoute } from 'next';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigmahorus.com.br').replace(/\/+$/, '');

// Libera tudo e bloqueia só a API. As áreas privadas (login, dashboard, plataforma…) NÃO entram aqui: elas usam
// `robots: noindex` no metadata, e o Google só lê o noindex se puder abrir a página.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
