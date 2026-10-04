import type { MetadataRoute } from 'next';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigmahorus.com.br').replace(/\/+$/, '');

// Buscadores indexam só as páginas públicas; área logada, API e painel da plataforma ficam de fora.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/api', '/plataforma', '/comecar', '/trocar-senha', '/folheto', '/verificar', '/login', '/onboarding', '/redefinir-senha'] }],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
