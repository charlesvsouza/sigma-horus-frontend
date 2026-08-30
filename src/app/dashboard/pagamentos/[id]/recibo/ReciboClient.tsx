'use client';

const METHOD_LABEL: Record<string, string> = { manual: 'Manual', pix: 'PIX', cash: 'Dinheiro', card: 'Cartão', asaas: 'Asaas' };
const brl = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 20mm; }
  body * { visibility: hidden !important; }
  .recibo-print, .recibo-print * { visibility: visible !important; }
  .recibo-print { position: absolute; left: 0; top: 0; width: 100%; color: #111 !important; background: #fff !important; font-family: Georgia, "Times New Roman", serif !important; }
  .recibo-noprint { display: none !important; }
}
`;

interface Lodge { name: string; cnpj?: string | null; addressLine?: string | null; addressNumber?: string | null; city?: string | null; state?: string | null; }
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

export default function ReciboClient({ payment }: { payment: Payment }) {
  const lodgeAddress = [payment.lodge.addressLine, payment.lodge.addressNumber, payment.lodge.city, payment.lodge.state].filter(Boolean).join(', ');

  return (
    <main className="min-h-screen px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="recibo-noprint flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Recibo de pagamento</h1>
            <p className="mt-1 text-sm text-sand-dark">Comprovante do lançamento — gere o PDF pelo diálogo de impressão do navegador.</p>
          </div>
          <button onClick={() => window.print()} className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-sigma-blue-deep hover:bg-gold-light">Salvar como PDF</button>
        </div>

        <div className="recibo-print rounded-xl border border-white/[6%] bg-sigma-card p-8 text-sm text-sand">
          <header className="border-b border-white/10 pb-4 text-center">
            <h2 className="text-xl font-bold text-sand-light">{payment.lodge.name}</h2>
            {payment.lodge.cnpj ? <p className="mt-1 text-xs text-sand-dark">CNPJ: {payment.lodge.cnpj}</p> : null}
            {lodgeAddress ? <p className="text-xs text-sand-dark">{lodgeAddress}</p> : null}
            <p className="mt-3 text-base font-semibold uppercase tracking-wide text-gold">Recibo de Pagamento</p>
          </header>

          <div className="mt-6 space-y-3">
            <p>
              Recebemos de <strong>{payment.memberName ?? 'contribuinte não vinculado'}</strong>
              {payment.memberCpf ? ` (CPF ${payment.memberCpf})` : ''} a quantia de <strong>{brl(payment.amount)}</strong>{' '}
              referente a <strong>{payment.accountTitle}</strong>, paga em {new Date(payment.paidAt).toLocaleDateString('pt-BR')} via{' '}
              {METHOD_LABEL[payment.method] ?? payment.method}.
            </p>
            {payment.note ? <p className="text-xs text-sand-dark">Observação: {payment.note}</p> : null}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 text-center text-xs text-sand-dark">
            <div>
              <div className="border-t border-white/20 pt-2">Tesoureiro</div>
            </div>
            <div>
              <div className="border-t border-white/20 pt-2">{payment.memberName ?? 'Contribuinte'}</div>
            </div>
          </div>

          <p className="mt-8 text-center text-[11px] text-sand-dark">Documento nº {payment.id.slice(-8).toUpperCase()} — emitido em {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </main>
  );
}
