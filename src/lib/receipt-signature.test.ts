import test from 'node:test';
import assert from 'node:assert/strict';
import { brDay, canonicalReceipt, generateReceiptCode, hashReceipt, normalizeReceiptCode, receiptMarkText, receiptSignerRole, type ReceiptContent } from './receipt-signature.ts';

const BASE: ReceiptContent = {
  paymentId: 'pay1', accountId: 'acc1', lodgeName: 'Loja Teste', accountTitle: 'Mensalidade 10/2026', payerName: 'Carlos', amount: 140, paidDay: '2026-10-05', method: 'pix',
};

test('quem assina recibo: Tesoureiro e Venerável; Administrador e demais não', () => {
  assert.equal(receiptSignerRole('treasurer'), 'Tesoureiro');
  assert.equal(receiptSignerRole(' Treasurer '), 'Tesoureiro');
  assert.equal(receiptSignerRole('venerable'), 'Venerável Mestre');
  assert.equal(receiptSignerRole('admin'), null);
  assert.equal(receiptSignerRole('secretary'), null);
  assert.equal(receiptSignerRole('member'), null);
  assert.equal(receiptSignerRole(undefined), null);
});

test('hash do recibo: estável e sensível a qualquer campo', () => {
  const h = hashReceipt(BASE);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(hashReceipt({ ...BASE }), h);
  for (const patch of [{ amount: 140.01 }, { paidDay: '2026-10-06' }, { payerName: 'Roberto' }, { method: 'cash' }, { accountTitle: 'Outra' }, { paymentId: 'pay2' }] as Partial<ReceiptContent>[]) {
    assert.notEqual(hashReceipt({ ...BASE, ...patch }), h);
  }
  assert.ok(canonicalReceipt(BASE).startsWith('recibo-pagamento/v1'));
});

test('código RC-XXXX-XXXX: formato, alfabeto sem ambíguos e normalização', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateReceiptCode();
    assert.match(code, /^RC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(normalizeReceiptCode(code.toLowerCase().replace(/-/g, ' ')), code);
  }
  assert.equal(normalizeReceiptCode('rc-ab2c-d3ef'), 'RC-AB2C-D3EF');
  assert.equal(normalizeReceiptCode('AC-AB2C-D3EF'), null); // código de termo de acordo não é de recibo
  assert.equal(normalizeReceiptCode('ABCD-1234'), null);    // certificado de presença
});

test('dia de Brasília e texto da marca', () => {
  assert.equal(brDay(new Date('2026-10-06T01:30:00Z')), '2026-10-05'); // ainda é dia 5 em Brasília
  assert.equal(brDay(new Date('2026-10-05T15:00:00Z')), '2026-10-05');
  const mark = receiptMarkText({ signedAt: new Date('2026-10-05T15:04:09Z'), code: 'RC-AB2C-D3EF' });
  assert.match(mark, /Assinado digitalmente em 05\/10\/2026/);
  assert.match(mark, /12:04:09/);
  assert.match(mark, /RC-AB2C-D3EF/);
});
