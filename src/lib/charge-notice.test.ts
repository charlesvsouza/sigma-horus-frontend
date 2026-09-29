import test from 'node:test';
import assert from 'node:assert/strict';
import { chargeNoticeLead, chargeUrgency, invoiceOpenBalance, whatsAppChargeMessage } from './charge-notice.ts';

const base = { memberName: 'Yuri', number: 'COB-202609-0043', amount: 120, dueDate: new Date('2026-10-10T00:00:00Z') };

test('abertura a vencer e vencida seguem o texto do e-mail, com a data sem deslocar o dia', () => {
  assert.equal(chargeNoticeLead({ ...base, overdue: false }), 'Caro irmão Yuri, lembramos a cobrança COB-202609-0043 no valor de R$ 120,00, com vencimento em 10/10/2026.');
  assert.equal(chargeNoticeLead({ ...base, overdue: true }), 'Caro irmão Yuri, consta a cobrança COB-202609-0043 no valor de R$ 120,00, vencida em 10/10/2026. Por gentileza, regularize.');
});

test('mensagem de WhatsApp: código Pix sozinho numa linha, pedido de comprovante e assinatura', () => {
  const msg = whatsAppChargeMessage({ ...base, overdue: false, pixCopyPaste: '000201PIX6304ABCD', instructions: 'Pix (chave): x' });
  const lines = msg.split('\n');
  assert.ok(lines.includes('000201PIX6304ABCD'));
  assert.ok(!msg.includes('Como pagar'));
  assert.match(msg, /responda esta mensagem com o comprovante/);
  assert.ok(msg.endsWith('Fraternalmente, Tesouraria.'));
});

test('sem chave Pix, a mensagem leva os dados bancários', () => {
  const msg = whatsAppChargeMessage({ ...base, overdue: true, pixCopyPaste: null, instructions: 'Depósito/TED: Banco X · Ag. 1 · Conta 2' });
  assert.match(msg, /Como pagar:\nDepósito\/TED: Banco X/);
});

test('urgência: vence hoje ainda está em dia; ontem é vencida; até 3 dias é a vencer', () => {
  const now = new Date('2026-10-10T15:00:00Z'); // 12h em Brasília
  assert.equal(chargeUrgency('2026-10-10T00:00:00Z', 'pending', now), 'dueSoon');
  assert.equal(chargeUrgency('2026-10-09T00:00:00Z', 'pending', now), 'overdue');
  assert.equal(chargeUrgency('2026-10-13T00:00:00Z', 'pending', now), 'dueSoon');
  assert.equal(chargeUrgency('2026-10-14T00:00:00Z', 'pending', now), 'later');
  assert.equal(chargeUrgency('2026-10-20T00:00:00Z', 'overdue', now), 'overdue');
});

test('saldo em aberto desconta pagamentos parciais e nunca passa do valor da cobrança', () => {
  assert.equal(invoiceOpenBalance(120, { amount: 120, status: 'pending', payments: [{ amount: 50 }] }), 70);
  assert.equal(invoiceOpenBalance(120, { amount: 120, status: 'paid', payments: [] }), 0);
  assert.equal(invoiceOpenBalance(120, { amount: 300, status: 'pending', payments: [] }), 120);
  assert.equal(invoiceOpenBalance(120, null), 120);
  assert.equal(invoiceOpenBalance(120, { amount: 120, status: 'pending', payments: [{ amount: 200 }] }), 0);
});
