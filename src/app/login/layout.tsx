import type { Metadata } from 'next';

// Área privada/transacional: fora do índice dos buscadores. NÃO bloquear no robots.txt — o Google precisa
// conseguir abrir a página para ler o noindex.
export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
