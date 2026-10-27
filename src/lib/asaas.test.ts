import test from 'node:test';
import assert from 'node:assert/strict';
import { asaasBaseUrl, asaasErrorMessage, isWebhookAuthorized, processWebhook } from './asaas.ts';

test('webhook is rejected when the lodge has no token configured (seguro por padrão)', () => {
  assert.equal(isWebhookAuthorized('anything', null), false);
  assert.equal(isWebhookAuthorized(null, undefined), false);
});

test('webhook requires matching token when the lodge configured one', () => {
  assert.equal(isWebhookAuthorized('secret-token', 'secret-token'), true);
  assert.equal(isWebhookAuthorized('wrong', 'secret-token'), false);
  assert.equal(isWebhookAuthorized(null, 'secret-token'), false);
});

test('asaasBaseUrl picks sandbox unless production', () => {
  assert.equal(asaasBaseUrl('production'), 'https://api.asaas.com/v3');
  assert.equal(asaasBaseUrl('sandbox'), 'https://sandbox.asaas.com/api/v3');
  assert.equal(asaasBaseUrl(null), 'https://sandbox.asaas.com/api/v3');
});

test('processWebhook surfaces the externalReference used for baixa automática', () => {
  const parsed = processWebhook({
    event: 'PAYMENT_RECEIVED',
    payment: { id: 'pay_123', status: 'RECEIVED', value: 150, customer: 'cus_1', externalReference: 'invoice_abc' },
  });

  assert.equal(parsed.event, 'PAYMENT_RECEIVED');
  assert.equal(parsed.payment?.externalReference, 'invoice_abc');
  assert.equal(parsed.payment?.value, 150);
});

test('erro do Asaas vira texto claro; Pix sem aprovação orienta a conta ou o boleto', () => {
  const pix = JSON.stringify({ errors: [{ code: 'invalid_billingType', description: 'O Pix não está disponível no momento. Para utilizá-lo, sua conta precisa estar aprovada.' }] });
  const r = asaasErrorMessage(400, pix);
  assert.equal(r.code, 'invalid_billingType');
  assert.match(r.message, /Pix ainda não está liberado/);
  assert.match(r.message, /Boleto/);
  assert.match(asaasErrorMessage(400, JSON.stringify({ errors: [{ code: 'x', description: 'CPF inválido.' }] })).message, /CPF inválido/);
  assert.match(asaasErrorMessage(500, '<html>').message, /erro 500/);
});
