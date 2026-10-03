import type { Metadata } from 'next';
import Link from 'next/link';
import { normalizeVerificationCode } from '@/lib/certificate';
import { longDateBR } from '@/lib/letterhead';
import { prismaAdmin } from '@/lib/prisma';
import { SESSION_TYPE_LABEL } from '@/lib/status-labels';

export const metadata: Metadata = {
  title: 'Verificar certificado — Sigma Horus',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

// Verificação pública do certificado de presença (QR impresso nele): sem login. Mostra só o
// necessário para confirmar a autenticidade — número, irmão, loja que emitiu e a sessão —,
// nunca e-mail ou telefone. Busca entre lojas (prismaAdmin): o código é único na plataforma.
export default async function VerificarPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawParam } = await params;
  // Endereço digitado/colado errado (ex.: "%" solto) não pode derrubar a página com 500.
  let raw = rawParam;
  try { raw = decodeURIComponent(rawParam); } catch { /* mantém o texto cru */ }
  const code = normalizeVerificationCode(raw);
  const visit = code
    ? await prismaAdmin.sessionVisitor.findUnique({
        where: { certificateCode: code },
        select: {
          certificateNumber: true,
          certificateSentAt: true,
          visitor: { select: { name: true, anonymizedAt: true } },
          session: { select: { title: true, date: true, type: true } },
          lodge: { select: { name: true, city: true, state: true } },
        },
      })
    : null;

  const valid = Boolean(visit?.certificateNumber);

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Verificação de certificado</p>
      {valid && visit ? (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <h1 className="text-xl font-semibold text-emerald-200">Certificado válido</h1>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-sand-dark">Número</dt><dd className="text-sand-light">{visit.certificateNumber}</dd></div>
            <div><dt className="text-sand-dark">Irmão</dt><dd className="text-sand-light">{visit.visitor.anonymizedAt ? '(dados removidos a pedido do titular)' : visit.visitor.name}</dd></div>
            <div><dt className="text-sand-dark">Emitido por</dt><dd className="text-sand-light">{visit.lodge.name}{visit.lodge.city ? ` — Oriente de ${visit.lodge.city}${visit.lodge.state ? `/${visit.lodge.state}` : ''}` : ''}</dd></div>
            <div>
              <dt className="text-sand-dark">Sessão</dt>
              <dd className="text-sand-light">Sessão {SESSION_TYPE_LABEL[visit.session.type] ?? visit.session.type} de {longDateBR(visit.session.date)} — {visit.session.title}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-sand-dark">Confira se os dados acima são os mesmos impressos no certificado.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
          <h1 className="text-xl font-semibold text-rose-200">Certificado não encontrado</h1>
          <p className="mt-2 text-sm text-sand">
            O código <strong className="font-mono">{code ?? raw}</strong> não corresponde a nenhum certificado emitido. Confira a digitação
            (o código tem 8 caracteres, como K7Q2-9XMA) ou fale com a loja que o emitiu.
          </p>
        </div>
      )}
      <Link href="/" className="mt-8 inline-block text-xs text-gold hover:text-gold-light">Sigma Horus — gestão para lojas maçônicas</Link>
    </div>
  );
}
