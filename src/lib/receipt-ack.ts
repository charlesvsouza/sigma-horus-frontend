import { brl } from '@/lib/currency';
import type { ReceiptCheck } from '@/lib/receipt-check';

// E-mail ao irmão depois do aviso de pagamento ("Já paguei" no portal ou comprovante registrado
// pela Tesouraria): serve de protocolo e diz o resultado da análise. Tom cuidadoso — divergência
// não é listada nem chamada assim (muitas vezes é só o banco formatando diferente); quem decide é
// a Tesouraria, na baixa, que já dispara o e-mail de "pagamento confirmado".

export interface ReceiptAckInput {
  memberName: string;
  lodgeName: string;
  items: { title: string; amount: number }[];
  invoiceNumbers: string[];
  noticeAt: Date;
  /** Resultado da conferência automática (só PDF). */
  check: ReceiptCheck | null;
  /** Havia comprovante anexado? */
  hasReceipt: boolean;
  /** Registrado pela Tesouraria (comprovante recebido fora do portal). */
  byStaff: boolean;
}

export function receiptAckMessage(i: ReceiptAckInput): { subject: string; text: string } {
  const what = i.items.map((it) => `"${it.title}" (${brl(it.amount)})`).join(', ');
  const numbers = i.invoiceNumbers.length > 0 ? ` — cobrança${i.invoiceNumbers.length > 1 ? 's' : ''} ${i.invoiceNumbers.join(', ')}` : '';
  const when = i.noticeAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const origin = i.byStaff ? 'A Tesouraria registrou o comprovante que você enviou' : 'Recebemos o seu aviso de pagamento';

  let status: string;
  if (i.check?.status === 'conferido') {
    const paid = i.check.amountPaid != null ? ` (${brl(i.check.amountPaid)})` : '';
    status = `Seu comprovante foi analisado: o valor${paid}, o recebedor (a loja) e o identificador do Pix conferem. Agora ele aguarda a baixa da Tesouraria, que confere o crédito na conta da loja.`;
  } else if (i.hasReceipt) {
    status = 'Seu comprovante foi recebido e será conferido pela Tesouraria, junto com o crédito na conta da loja, antes da baixa. Se precisarmos de algo, entraremos em contato.';
  } else {
    status = 'A Tesouraria vai conferir o crédito na conta da loja antes da baixa. Se tiver o comprovante, pode enviá-lo respondendo a Tesouraria ou pelo portal.';
  }

  const text = [
    `Caro irmão ${i.memberName},`,
    `${origin} de ${what}${numbers}, em ${when}.`,
    status,
    'Quando a baixa for registrada, você recebe a confirmação do pagamento. Enquanto isso, a conta aparece no portal como "Aguardando confirmação da Tesouraria".',
    `Fraternalmente, Tesouraria.\n${i.lodgeName}`,
  ].join('\n\n');

  return { subject: `Comprovante recebido — ${i.lodgeName}`, text };
}
