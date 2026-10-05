import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SourceCapture } from "@/components/source-capture";
import { NetworkGuard } from "@/components/network-guard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Cinzel: capitais inscricionais (pedra gravada de templo) — usada apenas em
// títulos cerimoniais da marca (landing). O corpo do produto segue Geist.
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sigmahorus.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Sistema para Loja Maçônica: Tesouraria e Pix | Sigma Horus",
    template: "%s | Sigma Horus",
  },
  description:
    "Sistema para loja maçônica: tesouraria com Pix e baixa automática, mensalidades, portal do irmão, secretaria e chancelaria. Teste por 10 dias.",
  applicationName: "Sigma Horus",
  // Verificação do Google Search Console / Bing Webmaster: preencha as variáveis na Vercel (ver divulgacao/SEO.md).
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined },
  other: process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } : undefined,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: APP_URL,
    siteName: "Sigma Horus",
    title: "Sistema para Loja Maçônica: Tesouraria e Pix | Sigma Horus",
    description:
      "Tesouraria com Pix e baixa automática, mensalidades, portal do irmão, secretaria e chancelaria da loja maçônica em uma só plataforma. Teste por 10 dias.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sistema para Loja Maçônica: Tesouraria e Pix | Sigma Horus",
    description:
      "Tesouraria com Pix e baixa automática, mensalidades, portal do irmão, secretaria e chancelaria da loja maçônica. Teste por 10 dias.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A1628",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/*
        Tema da marca fixo (escuro) fora do dashboard: a preferência salva em
        localStorage só é lida/aplicada dentro de /dashboard (ver DashboardShell
        e dashboard/layout.tsx). Sem script aqui — landing, login e páginas
        institucionais sempre renderizam no escuro padrão (sem data-theme).
      */}
      <body className="min-h-full flex flex-col">
        {children}
        <SourceCapture />
        <NetworkGuard />
        <Analytics />
      </body>
    </html>
  );
}
