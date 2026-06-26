import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import "./globals.css";

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
    default: "Sigma Horus — a tesouraria da sua loja no prumo",
    template: "%s · Sigma Horus",
  },
  description:
    "Plataforma SaaS para gestão financeira e administrativa de lojas maçônicas: tesouraria, cobrança automatizada, presença e auditoria.",
  applicationName: "Sigma Horus",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: APP_URL,
    siteName: "Sigma Horus",
    title: "Sigma Horus — a tesouraria da sua loja no prumo",
    description:
      "Tesouraria, secretaria, chancelaria e hospitalaria — a loja maçônica inteira, em uma só plataforma segura.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sigma Horus — a tesouraria da sua loja no prumo",
    description:
      "Gestão financeira e administrativa para lojas maçônicas, com a precisão de quem presta contas.",
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
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
