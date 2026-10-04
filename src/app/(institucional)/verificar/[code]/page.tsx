import type { Metadata } from 'next';
import Link from 'next/link';
import { hashAgreement, normalizeSignatureCode, partyLabel } from '@/lib/agreement-signature';
import { brDay, hashReceipt, normalizeReceiptCode } from '@/lib/receipt-signature';
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
  // Código de assinatura digital de termo de acordo (AC-XXXX-XXXX): confirma quem assinou, quando e se o
  // acordo continua igual ao que foi assinado. Não mostra o irmão nem valores (dado financeiro sensível).
  const sigCode = normalizeSignatureCode(raw);
  if (sigCode) {
    const sig = await prismaAdmin.memberBlockSignature.findUnique({
      where: { code: sigCode },
      select: {
        party: true, signerName: true, signerRole: true, signedAt: true, contentHash: true,
        lodge: { select: { name: true, city: true, state: true } },
        block: { select: { id: true, kind: true, memberId: true, total: true, regularizationFee: true, extraCharge: true, installments: true, firstDueDate: true, member: { select: { name: true } }, items: { select: { kind: true, title: true, openAmount: true, sortOrder: true } } } },
      },
    });
    const intact = sig
      ? hashAgreement({
          blockId: sig.block.id, memberId: sig.block.memberId, memberName: sig.block.member.name,
          total: Number(sig.block.total), regularizationFee: Number(sig.block.regularizationFee), extraCharge: Number(sig.block.extraCharge),
          installments: sig.block.installments, firstDueDate: sig.block.firstDueDate,
          items: sig.block.items.map((i) => ({ kind: i.kind, title: i.title, openAmount: Number(i.openAmount), sortOrder: i.sortOrder })),
        }) === sig.contentHash
      : false;
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Verificação de assinatura digital</p>
        {sig ? (
          <div className={`mt-4 rounded-xl border p-6 ${intact ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
            <h1 className={`text-xl font-semibold ${intact ? 'text-emerald-200' : 'text-amber-200'}`}>{intact ? 'Assinatura válida' : 'Assinatura encontrada, mas o acordo foi alterado'}</h1>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="text-sand-dark">Documento</dt><dd className="text-sand-light">{sig.block.kind === 'settlement' ? 'Termo de acordo de quitação de dívidas' : 'Termo de acordo de regularização'}</dd></div>
              <div><dt className="text-sand-dark">Assinado por</dt><dd className="text-sand-light">{sig.signerName} — {sig.signerRole || partyLabel(sig.party)}</dd></div>
              <div><dt className="text-sand-dark">Em</dt><dd className="text-sand-light">{sig.signedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short' })}</dd></div>
              <div><dt className="text-sand-dark">Loja</dt><dd className="text-sand-light">{sig.lodge.name}{sig.lodge.city ? ` — Oriente de ${sig.lodge.city}${sig.lodge.state ? `/${sig.lodge.state}` : ''}` : ''}</dd></div>
              <div><dt className="text-sand-dark">Resumo (hash)</dt><dd className="font-mono text-xs text-sand-light">{sig.contentHash.slice(0, 16)}…</dd></div>
            </dl>
            <p className="mt-4 text-xs text-sand-dark">
              {intact ? 'O conteúdo do acordo é o mesmo que foi assinado.' : 'O conteúdo do acordo é diferente do que existia no momento da assinatura: procure a Tesouraria da loja.'}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
            <h1 className="text-xl font-semibold text-rose-200">Assinatura não encontrada</h1>
            <p className="mt-2 text-sm text-sand">O código <strong className="font-mono">{sigCode}</strong> não corresponde a nenhuma assinatura registrada. Confira a digitação ou fale com a loja.</p>
          </div>
        )}
        <Link href="/" className="mt-8 inline-block text-xs text-gold hover:text-gold-light">Sigma Horus — gestão para lojas maçônicas</Link>
      </div>
    );
  }

  // Código de assinatura digital de RECIBO (RC-XXXX-XXXX): confirma quem assinou, quando e se o recibo continua igual ao
  // assinado. Não mostra o pagador nem o valor.
  const receiptCode = normalizeReceiptCode(raw);
  if (receiptCode) {
    const sig = await prismaAdmin.paymentReceiptSignature.findUnique({
      where: { code: receiptCode },
      select: {
        signerName: true, signerRole: true, signedAt: true, contentHash: true,
        lodge: { select: { name: true, city: true, state: true } },
        payment: { select: { id: true, accountId: true, amount: true, paidAt: true, method: true, member: { select: { name: true } }, account: { select: { title: true, member: { select: { name: true } } } }, lodge: { select: { name: true } } } },
      },
    });
    const intact = sig
      ? hashReceipt({
          paymentId: sig.payment.id, accountId: sig.payment.accountId, lodgeName: sig.payment.lodge.name, accountTitle: sig.payment.account?.title ?? '—',
          payerName: (sig.payment.member ?? sig.payment.account?.member)?.name ?? null, amount: Number(sig.payment.amount), paidDay: brDay(sig.payment.paidAt), method: sig.payment.method,
        }) === sig.contentHash
      : false;
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Verificação de assinatura digital</p>
        {sig ? (
          <div className={`mt-4 rounded-xl border p-6 ${intact ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
            <h1 className={`text-xl font-semibold ${intact ? 'text-emerald-200' : 'text-amber-200'}`}>{intact ? 'Assinatura válida' : 'Assinatura encontrada, mas o recibo foi alterado'}</h1>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="text-sand-dark">Documento</dt><dd className="text-sand-light">Recibo de pagamento</dd></div>
              <div><dt className="text-sand-dark">Assinado por</dt><dd className="text-sand-light">{sig.signerName} — {sig.signerRole}</dd></div>
              <div><dt className="text-sand-dark">Em</dt><dd className="text-sand-light">{sig.signedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'medium' })}</dd></div>
              <div><dt className="text-sand-dark">Loja</dt><dd className="text-sand-light">{sig.lodge.name}{sig.lodge.city ? ` — Oriente de ${sig.lodge.city}${sig.lodge.state ? `/${sig.lodge.state}` : ''}` : ''}</dd></div>
              <div><dt className="text-sand-dark">Resumo (hash)</dt><dd className="font-mono text-xs text-sand-light">{sig.contentHash.slice(0, 16)}…</dd></div>
            </dl>
            <p className="mt-4 text-xs text-sand-dark">
              {intact ? 'O conteúdo do recibo é o mesmo que foi assinado.' : 'O conteúdo do recibo é diferente do que existia no momento da assinatura: procure a Tesouraria da loja.'}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
            <h1 className="text-xl font-semibold text-rose-200">Assinatura não encontrada</h1>
            <p className="mt-2 text-sm text-sand">O código <strong className="font-mono">{receiptCode}</strong> não corresponde a nenhuma assinatura registrada. Confira a digitação ou fale com a loja.</p>
          </div>
        )}
        <Link href="/" className="mt-8 inline-block text-xs text-gold hover:text-gold-light">Sigma Horus — gestão para lojas maçônicas</Link>
      </div>
    );
  }

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
