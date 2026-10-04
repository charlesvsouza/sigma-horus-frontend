import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '@/components/legal-doc';
import { GUIDES } from '@/lib/guides';

export const metadata: Metadata = {
  title: 'Guias para a tesouraria da loja maçônica',
  alternates: { canonical: '/guias' },
  description: 'Guias práticos para a tesouraria de lojas maçônicas: balancete, mensalidade em atraso, Pix com baixa automática, prestação de contas e plano de contas.',
};

export default function GuiasPage() {
  return (
    <LegalDoc
      eyebrow="Guias"
      title="Guias para a tesouraria da loja"
      intro="Textos curtos e práticos sobre os assuntos que mais dão trabalho à Tesouraria: do balancete à cobrança, da prestação de contas ao plano de contas. Sem jargão e sem expor irmãos ou lojas."
    >
      <ul className="space-y-6">
        {GUIDES.map((g) => (
          <li key={g.slug} className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <h2 className="text-lg font-semibold text-sand-light">
              <Link href={`/guias/${g.slug}`} className="transition-colors hover:text-gold">{g.title}</Link>
            </h2>
            <p className="mt-2 text-sm leading-6 text-sand">{g.description}</p>
            <Link href={`/guias/${g.slug}`} className="mt-3 inline-block text-sm font-medium text-gold hover:text-gold-light">Ler o guia →</Link>
          </li>
        ))}
      </ul>
    </LegalDoc>
  );
}
