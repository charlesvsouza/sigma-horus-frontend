import type { Metadata } from 'next';
import Image from 'next/image';
import QRCode from 'qrcode';
import { FOUNDER_PRICE_LOCK_MONTHS, FOUNDER_SLOTS } from '@/lib/founders';
import { PrintButton } from './print-button';

// Folheto de uma página (A4) para imprimir ou salvar em PDF: sessões magnas, congressos,
// visitas. O QR leva à landing com o canal "folheto" marcado (lib/acquisition.ts).
// ?campanha=xxx troca a campanha do link (ex.: um folheto por evento).

export const metadata: Metadata = {
  title: 'Folheto',
  robots: { index: false, follow: false },
};

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigmahorus.com.br').replace(/\/+$/, '');

const benefits = [
  ['Tesouraria sem planilha', 'Mensalidades recorrentes, contas a pagar e a receber, conciliação bancária e prestação de contas pronta para o fechamento do veneralato.'],
  ['O irmão paga pelo portal', 'Pix com QR Code — uma conta ou várias num Pix só. Pelo Asaas, a baixa é automática; na conta da loja, sem tarifa do sistema.'],
  ['Transparência para cada irmão', 'Histórico de tudo o que já pagou, com recibo, e a declaração de regularidade emitida na hora.'],
  ['Art. 002 no automático', 'Inadimplência acompanhada pela régua do regimento, com lembretes por e-mail, WhatsApp ou SMS.'],
  ['A loja inteira', 'Secretaria, sessões e frequência, chancelaria e materiais, hospitalaria e o Tronco — num só lugar.'],
  ['Seguro e conforme a LGPD', 'Cada loja só vê os próprios dados, cada cargo a sua área, auditoria de tudo e backup diário.'],
];

export default async function Folheto({ searchParams }: { searchParams: Promise<{ campanha?: string }> }) {
  const { campanha } = await searchParams;
  const campaign = (campanha ?? 'fundadoras').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'fundadoras';
  const link = `${APP_URL}/?utm_source=folheto&utm_medium=impresso&utm_campaign=${campaign}`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#0A1628', light: '#FFFFFF' } });

  return (
    <main className="folheto min-h-screen bg-[#f4efe4] px-4 py-8 text-[#0A1628] print:bg-white print:p-0">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        html, body { background: #f4efe4 !important; }
        @media print { html, body { background: #fff !important; } .no-print { display: none !important; } .folheto { min-height: auto; } }
      `}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[190mm] items-center justify-between gap-4 text-sm">
        <p className="text-[#5b5344]">Folheto A4 — use <strong>Imprimir → Salvar como PDF</strong>. Campanha do QR: <code>{campaign}</code></p>
        <PrintButton />
      </div>

      <article className="mx-auto flex max-w-[190mm] flex-col gap-6 rounded-xl border border-[#c9a54c]/50 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <header className="flex items-center gap-5 border-b-2 border-double border-[#c9a54c] pb-5">
          <Image src="/sigmahorus_ouro.png" alt="" width={1024} height={1024} className="h-20 w-20 shrink-0 object-contain" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.35em] text-[#9a7a2c]">GESTÃO DA LOJA MAÇÔNICA</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-tight">Sigma Horus</h1>
            <p className="mt-1 text-base text-[#3b3a36]">Toda a loja, no prumo — da tesouraria à hospitalaria, com a precisão de quem presta contas.</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-4">
          {benefits.map(([t, d]) => (
            <div key={t} className="border-l-2 border-[#c9a54c] pl-3">
              <h2 className="text-sm font-bold">{t}</h2>
              <p className="mt-1 text-[12.5px] leading-snug text-[#3b3a36]">{d}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg bg-[#0A1628] px-6 py-5 text-white">
          <p className="text-[11px] font-semibold tracking-[0.35em] text-[#e2c46f]">OFERTA DE LANÇAMENTO</p>
          <h2 className="mt-1 font-display text-2xl font-bold">Lojas Fundadoras</h2>
          <p className="mt-1 text-[13px] leading-snug text-[#e9e4d8]">
            As primeiras {FOUNDER_SLOTS} lojas que assinarem mantêm o preço contratado por {FOUNDER_PRICE_LOCK_MONTHS} meses, sem reajuste,
            e recebem o selo de Loja Fundadora. Teste grátis de 10 dias.
          </p>
        </section>

        <section className="flex items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR em data URL */}
          <img src={qr} alt="QR Code para conhecer o Sigma Horus" width={150} height={150} className="h-[150px] w-[150px] shrink-0" />
          <div>
            <p className="text-lg font-bold">Aponte a câmera e conheça</p>
            <p className="mt-1 text-sm text-[#3b3a36]">Planos a partir de R$ 110/mês, por faixa de obreiros. Sem instalar nada: computador e celular.</p>
            <p className="mt-2 font-mono text-sm font-semibold">sigmahorus.com.br</p>
          </div>
        </section>

        <footer className="border-t border-[#c9a54c]/50 pt-3 text-center text-[11px] text-[#5b5344]">
          Sigma Horus — a tesouraria da sua loja no prumo · sigmahorus.com.br
        </footer>
      </article>
    </main>
  );
}
