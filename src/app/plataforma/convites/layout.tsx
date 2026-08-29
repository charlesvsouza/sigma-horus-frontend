import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Convites da plataforma',
  robots: { index: false, follow: false },
};

export default function ConvitesPlataformaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
