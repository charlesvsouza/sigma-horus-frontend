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
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
