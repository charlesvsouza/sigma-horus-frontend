'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brl } from '@/lib/currency';
import { Alert, Button, useConfirm } from '@/components/ui';
import { receiptMarkText } from '@/lib/receipt-signature';
import { ReportActions, ReportDocument } from '@/components/report/report-document';

const METHOD_LABEL: Record<string, string> = { manual: 'Manual', pix: 'PIX', cash: 'Dinheiro', card: 'Cartão', asaas: 'Asaas', 'asaas-cash': 'Dinheiro (baixa no Asaas)' };

interface Lodge { name: string; cnpj?: string | null; addressLine?: string | null; addressNumber?: string | null; city?: string | null; state?: string | null; crestUrl?: string | null; }
interface Payment {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  note?: string | null;
  accountTitle: string;
  memberName?: string | null;
  memberCpf?: string | null;
  lodge: Lodge;
}

interface Signature { signerName: string; signerRole: string; signedAt: string; code: string }

export default function ReciboClient({ payment, treasurerName, issuedBy, signature, canSign }: { payment: Payment; treasurerName?: string | null; issuedBy?: string | null; signature: Signature | null; canSign: boolean }) {
  const router = useRouter();
  const askConfirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lodgeAddress = [payment.lodge.addressLine, payment.lodge.addressNumber, payment.lodge.city, payment.lodge.state].filter(Boolean).join(', ');

  async function sign() {
    if (!(await askConfirm({ title: 'Assinar recibo', message: 'Você assina digitalmente este recibo, em nome da Tesouraria. O sistema grava a data e a hora, o seu nome e um código de verificação. Cada recibo é assinado uma vez.', confirmLabel: 'Assinar digitalmente' }))) return;
    setBusy(true);
    setError('');
    const res = await fetch(`/api/payments/${payment.id}/sign-receipt`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Não foi possível assinar.'); return; }
    router.refresh();
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rpt-noprint flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Recibo de pagamento</h1>
            <p className="mt-1 text-sm text-sand-dark">Comprovante do lançamento — gere o PDF pelo diálogo de impressão do navegador.</p>
          </div>
          <ReportActions />
        </div>
        {!signature && canSign ? (
          <div className="rpt-noprint">
            <Alert intent="warn">
              <p className="text-sm font-medium">Este recibo ainda não tem assinatura digital.</p>
              <p className="mt-1 text-xs">Ao assinar, o sistema grava a data e a hora e um código de verificação, que saem impressos no recibo.</p>
              {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
              <div className="mt-3"><Button size="sm" onClick={() => void sign()} disabled={busy}>{busy ? 'Assinando…' : 'Assinar recibo'}</Button></div>
            </Alert>
          </div>
        ) : null}

        <ReportDocument
          lodgeName={payment.lodge.name}
          crestUrl={payment.lodge.crestUrl}
          title="Recibo de pagamento"
          details={[payment.lodge.cnpj ? `CNPJ: ${payment.lodge.cnpj}` : null, lodgeAddress, `Documento nº ${payment.id.slice(-8).toUpperCase()}`]}
          issuedBy={issuedBy}
          // O recibo não leva assinatura do pagador: só a do Tesoureiro (ou do Venerável), em formato digital.
          signatures={[
            signature
              ? { role: signature.signerRole, name: signature.signerName, mark: receiptMarkText({ signedAt: new Date(signature.signedAt), code: signature.code }) }
              : { role: 'Tesoureiro', name: treasurerName },
          ]}
          className="p-8! text-sm text-sand"
        >
          <div className="mt-2 space-y-3 text-[0.95rem] leading-relaxed">
            <p>
              Recebemos de <strong>{payment.memberName ?? 'contribuinte não vinculado'}</strong>
              {payment.memberCpf ? ` (CPF ${payment.memberCpf})` : ''} a quantia de <strong>{brl(payment.amount)}</strong>{' '}
              referente a <strong>{payment.accountTitle}</strong>, paga em {new Date(payment.paidAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} via{' '}
              {METHOD_LABEL[payment.method] ?? payment.method}.
            </p>
            {payment.note ? <p className="text-xs text-sand-dark">Observação: {payment.note}</p> : null}
            {signature ? <p className="text-xs text-sand-dark">Verifique a autenticidade em <strong>sigmahorus.com.br/verificar/{signature.code}</strong>.</p> : null}
          </div>
        </ReportDocument>
      </div>
    </main>
  );
}
