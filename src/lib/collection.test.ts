import test from 'node:test';
import assert from 'node:assert/strict';
import {
  feeFromNet, isAsaasMode, isOutOfPolicyMethod, normalizeBillingChoice, normalizeCollectionMode, paymentInstructions,
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
