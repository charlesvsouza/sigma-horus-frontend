import type { MetadataRoute } from 'next';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigmahorus.com.br').replace(/\/+$/, '');

// Páginas públicas para os buscadores (a landing é a principal).
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
    { path: '', priority: 1, changeFrequency: 'weekly' },
    { path: '/sobre', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/manual', priority: 0.6, changeFrequency: 'weekly' },
    { path: '/compliance', priority: 0.4, changeFrequency: 'yearly' },
    { path: '/termos', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/privacidade', priority: 0.3, changeFrequency: 'yearly' },
  ];
  return pages.map((p) => ({ url: `${APP_URL}${p.path}`, lastModified: new Date(), changeFrequency: p.changeFrequency, priority: p.priority }));
}
