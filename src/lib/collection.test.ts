import test from 'node:test';
import assert from 'node:assert/strict';
import {
  feeFromNet, isAsaasMode, isOutOfPolicyMethod, normalizeBillingChoice, normalizeCollectionMode, paymentInstructions, payHint, portalPayUrl,
} from './collection.ts';

test('modo de recebimento: padrão é Modo Loja; só "asaas" liga o Asaas', () => {
  assert.equal(normalizeCollectionMode(undefined), 'lodge');
  assert.equal(normalizeCollectionMode('qualquer'), 'lodge');
  assert.equal(normalizeCollectionMode('asaas'), 'asaas');
  assert.equal(isAsaasMode({ collectionMode: 'asaas' }), true);
  assert.equal(isAsaasMode({ collectionMode: 'lodge' }), false);
  assert.equal(isAsaasMode(null), false);
});

test('cartão fora: só Pix ou boleto são aceitos na emissão', () => {
  assert.equal(normalizeBillingChoice('BOLETO'), 'BOLETO');
  assert.equal(normalizeBillingChoice('PIX'), 'PIX');
  assert.equal(normalizeBillingChoice('CREDIT_CARD'), 'PIX');
  assert.equal(normalizeBillingChoice('UNDEFINED'), 'PIX');
  assert.equal(normalizeBillingChoice(undefined, 'BOLETO'), 'BOLETO');
  assert.equal(isOutOfPolicyMethod('CREDIT_CARD'), true);
  assert.equal(isOutOfPolicyMethod('PIX'), false);
  assert.equal(isOutOfPolicyMethod(null), false);
});

test('tarifa real = valor cobrado − líquido, em centavos', () => {
  assert.equal(feeFromNet(110, 108.01), 1.99);
  assert.equal(feeFromNet(30.3, 28.31), 1.99);
  assert.equal(feeFromNet(110, 110), 0);
  assert.equal(feeFromNet(110, 112), 0); // líquido maior (juros/multa): não há tarifa negativa
});

test('sem líquido informado não inventa tarifa', () => {
  assert.equal(feeFromNet(110, null), null);
  assert.equal(feeFromNet(110, undefined), null);
  assert.equal(feeFromNet(110, Number.NaN), null);
});

test('instruções de pagamento do Modo Loja', () => {
  assert.equal(paymentInstructions(null), null);
  assert.equal(paymentInstructions({}), null);
  assert.equal(paymentInstructions({ pixKey: '12.345.678/0001-90' }), 'Pix (chave): 12.345.678/0001-90');
  assert.equal(
    paymentInstructions({ pixKey: 'a@b.com', bankName: 'Santander', bankAgency: '1234', bankAccount: '5678-9' }),
    'Pix (chave): a@b.com\nDepósito/TED: Santander · Ag. 1234 · Conta 5678-9',
  );
});

test('lembrete aponta para o portal, onde o irmão paga', () => {
  const app = 'https://app.exemplo.org/';
  assert.equal(portalPayUrl(app), 'https://app.exemplo.org/dashboard/portal');
  assert.equal(portalPayUrl(''), 'https://sigmahorus.com.br/dashboard/portal');
  // Modo Asaas com cobrança emitida: link dela + portal.
  assert.equal(
    payHint({ collectionMode: 'asaas' }, { asaasInvoiceUrl: 'https://asaas/i/1' }, app),
    ' Pague pelo link: https://asaas/i/1 ou pelo seu portal: https://app.exemplo.org/dashboard/portal.',
  );
  // Modo Asaas ainda não emitida: o portal emite na hora.
  assert.equal(payHint({ collectionMode: 'asaas' }, {}, app), ' Pague pelo seu portal: https://app.exemplo.org/dashboard/portal.');
  // Modo Loja com chave Pix: instruções + portal (QR com o valor).
  assert.equal(
    payHint({ collectionMode: 'lodge', pixKey: 'tes@loja.org' }, {}, app),
    ' Como pagar — Pix (chave): tes@loja.org. Ou pague pelo seu portal: https://app.exemplo.org/dashboard/portal.',
  );
  // Modo Loja só com banco: o portal não tem como gerar Pix — não é oferecido.
  assert.equal(
    payHint({ collectionMode: 'lodge', bankName: 'Banco X', bankAgency: '1', bankAccount: '2' }, {}, app),
    ' Como pagar — Depósito/TED: Banco X · Ag. 1 · Conta 2.',
  );
  assert.equal(payHint({ collectionMode: 'lodge' }, {}, app), '');
});
