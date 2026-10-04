import type { MetadataRoute } from 'next';
import { GUIDES } from '@/lib/guides';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigmahorus.com.br').replace(/\/+$/, '');

// Páginas públicas para os buscadores. `lastModified` é a data REAL da última mudança de conteúdo (fixa, não "agora"):
// o Google desconfia de sitemap cuja data muda a cada acesso. Ao alterar o texto de uma página, atualize a data dela aqui.
const pages: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly'; lastModified: string }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly', lastModified: '2026-10-04' },
  { path: '/guias', priority: 0.8, changeFrequency: 'monthly', lastModified: '2026-10-04' },
  { path: '/sobre', priority: 0.7, changeFrequency: 'monthly', lastModified: '2026-06-25' },
  { path: '/manual', priority: 0.6, changeFrequency: 'weekly', lastModified: '2026-10-04' },
  { path: '/compliance', priority: 0.4, changeFrequency: 'yearly', lastModified: '2026-09-22' },
  { path: '/termos', priority: 0.3, changeFrequency: 'yearly', lastModified: '2026-07-01' },
  { path: '/privacidade', priority: 0.3, changeFrequency: 'yearly', lastModified: '2026-09-18' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const guides = GUIDES.map((g) => ({ path: `/guias/${g.slug}`, priority: 0.8, changeFrequency: 'monthly' as const, lastModified: g.updatedAt }));
  return [...pages, ...guides].map((p) => ({ url: `${APP_URL}${p.path}`, lastModified: p.lastModified, changeFrequency: p.changeFrequency, priority: p.priority }));
}
