import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptableAmounts, lateChargeConfig, lateChargeMarker, lateChargeSentence, mainPaymentIdFromMarker, pixAmount } from './late-charge.ts';
import { checkReceipt } from './receipt-check.ts';
import { receiptAckMessage } from './receipt-ack.ts';
import { whatsAppChargeMessage } from './charge-notice.ts';

const on = lateChargeConfig({ chargeLateFeesOnPix: true, lateFeePercent: 2, lateInterestPercentMonth: 1 });
const due = new Date('2026-09-10T00:00:00Z');
const brlFmt = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

test('opção desligada ou sem percentuais: Pix pelo saldo', () => {
  const off = lateChargeConfig({ chargeLateFeesOnPix: false, lateFeePercent: 2, lateInterestPercentMonth: 1 });
  assert.equal(off.enabled, false);
  assert.equal(lateChargeConfig({ chargeLateFeesOnPix: true }).enabled, false);
  assert.deepEqual(pixAmount(120, due, off, new Date('2026-10-10T15:00:00Z')), { principal: 120, fee: 0, interest: 0, extra: 0, total: 120 });
});

test('em dia (inclusive no dia do vencimento) não há acréscimo', () => {
  assert.equal(pixAmount(120, due, on, new Date('2026-09-10T20:00:00Z')).extra, 0);
});

test('vencida: multa 2% + juros 1% ao mês pro-rata por dia, em centavos', () => {
  // 30 dias de atraso: multa 2,40 + juros 1,20.
  const p = pixAmount(120, due, on, new Date('2026-10-10T15:00:00Z'));
  assert.deepEqual(p, { principal: 120, fee: 2.4, interest: 1.2, extra: 3.6, total: 123.6 });
  assert.equal(lateChargeSentence(p, brlFmt), 'Com multa (R$ 2,40) e juros (R$ 1,20) por atraso até hoje, o valor atualizado é R$ 123,60.');
});

test('conferência aceita o valor com acréscimo de qualquer dia desde o vencimento', () => {
  const now = new Date('2026-10-10T15:00:00Z');
  const amounts = acceptableAmounts([{ balance: 120, dueDate: due }], on, now);
  assert.ok(amounts.includes(120));
  assert.ok(amounts.includes(123.6)); // hoje
  assert.ok(amounts.includes(pixAmount(120, due, on, new Date('2026-09-20T15:00:00Z')).total)); // Pix de dias atrás
  assert.equal(acceptableAmounts([{ balance: 120, dueDate: due }], lateChargeConfig(null), now).length, 1);

  const text = `Comprovante Pix 10/10/2026 - 10:00:00 Valor: R$ 123,60 CNPJ 07.470.382/0001-66 Identificador: COB2026090043 E60746948202610101000A1804dFKhzY`;
  const r = checkReceipt(text, { txids: ['COB2026090043'], amount: 120, amounts, lodgeCnpj: '07.470.382/0001-66' });
  assert.equal(r.status, 'conferido');
  assert.equal(r.amountPaid, 123.6);
  assert.equal(checkReceipt(text, { txids: ['COB2026090043'], amount: 120, lodgeCnpj: '07.470.382/0001-66' }).amount, false);
});

test('marca do acréscimo liga à baixa principal (estorno em conjunto)', () => {
  assert.equal(mainPaymentIdFromMarker(lateChargeMarker('cmpay123')), 'cmpay123');
  assert.equal(mainPaymentIdFromMarker('Outra descrição'), null);
  assert.equal(mainPaymentIdFromMarker(null), null);
});

test('mensagem do WhatsApp mostra o cálculo sem mudar a abertura', () => {
  const msg = whatsAppChargeMessage({ memberName: 'Yuri', number: 'COB-1', amount: 120, dueDate: due, overdue: true, pixCopyPaste: '000201X', lateChargeSentence: 'Com multa (R$ 2,40) e juros (R$ 1,20) por atraso até hoje, o valor atualizado é R$ 123,60.' });
  assert.match(msg, /no valor de R\$\s120,00, vencida em 10\/09\/2026\. Por gentileza, regularize\. Com multa/);
});

const ackBase = {
  memberName: 'Yuri', lodgeName: 'ARLS Tim Maia', items: [{ title: 'Mensalidade de setembro', amount: 120 }],
  invoiceNumbers: ['COB-202609-0043'], noticeAt: new Date('2026-09-29T15:00:00Z'), hasReceipt: true, byStaff: false,
};

test('e-mail de protocolo: conferido diz o que bateu e que aguarda a baixa', () => {
  const r = receiptAckMessage({ ...ackBase, check: { status: 'conferido', txid: true, amount: true, payee: true, e2e: 'E1', paidAt: null, amountsFound: [123.6], amountPaid: 123.6 } });
  assert.match(r.text, /Recebemos o seu aviso de pagamento de "Mensalidade de setembro" \(R\$\s120,00\) — cobrança COB-202609-0043/);
  assert.match(r.text, /foi analisado: o valor \(R\$\s123,60\), o recebedor \(a loja\) e o identificador do Pix conferem/);
  assert.match(r.text, /aguarda a baixa da Tesouraria/);
});

test('e-mail de protocolo: divergência não é exposta ao irmão; Tesouraria aparece como origem', () => {
  const r = receiptAckMessage({ ...ackBase, byStaff: true, check: { status: 'divergente', txid: false, amount: true, payee: true, e2e: null, paidAt: null, amountsFound: [] } });
  assert.doesNotMatch(r.text, /diverg/i);
  assert.match(r.text, /A Tesouraria registrou o comprovante que você enviou/);
  assert.match(r.text, /será conferido pela Tesouraria/);
});
