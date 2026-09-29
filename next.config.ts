import type { NextConfig } from "next";

// Headers de segurança em todas as respostas (o HSTS já vem do Vercel). Sem CSP por ora: o
// sistema usa imagens do storage, QR em data: e o checkout do Stripe por redirecionamento — uma
// CSP precisaria ser calibrada em modo "report-only" antes.
const SECURITY_HEADERS = [
  // Ninguém embute o sistema num <iframe> (clickjacking na tela de login e nas de pagamento).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // Fontes do certificado de presença: lidas do disco pelas rotas que geram o PDF — o
  // rastreamento de arquivos do build não as veria sozinho.
  outputFileTracingIncludes: {
    "/api/certificates/**": ["./src/assets/fonts/**"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // A prévia do certificado abre num <iframe> da própria tela (o último valor vale).
      { source: "/api/certificates/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;
