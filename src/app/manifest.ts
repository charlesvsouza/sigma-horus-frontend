import type { MetadataRoute } from 'next';

// Permite instalar o Sigma Horus na tela inicial do celular (PWA leve, sem service worker).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sigma Horus',
    short_name: 'Sigma Horus',
    description: 'A tesouraria e a gestão da sua loja maçônica, no prumo.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0A1628',
    theme_color: '#0A1628',
    lang: 'pt-BR',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
