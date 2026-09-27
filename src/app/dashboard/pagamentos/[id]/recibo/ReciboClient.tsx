'use client';

import { brl } from '@/lib/currency';
import { ReportActions, ReportDocument } from '@/components/report/report-document';

const METHOD_LABEL: Record<string, string> = { manual: 'Manual', pix: 'PIX', cash: 'Dinheiro', card: 'Cartão', asaas: 'Asaas' };

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

export default function ReciboClient({ payment, treasurerName, issuedBy }: { payment: Payment; treasurerName?: string | null; issuedBy?: string | null }) {
  const lodgeAddress = [payment.lodge.addressLine, payment.lodge.addressNumber, payment.lodge.city, payment.lodge.state].filter(Boolean).join(', ');

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

        <ReportDocument
          lodgeName={payment.lodge.name}
          crestUrl={payment.lodge.crestUrl}
          title="Recibo de pagamento"
          details={[payment.lodge.cnpj ? `CNPJ: ${payment.lodge.cnpj}` : null, lodgeAddress, `Documento nº ${payment.id.slice(-8).toUpperCase()}`]}
          issuedBy={issuedBy}
          signatures={[
            { role: 'Tesoureiro', name: treasurerName },
            { role: 'Contribuinte', name: payment.memberName },
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
          </div>
        </ReportDocument>
      </div>
    </main>
  );
}
