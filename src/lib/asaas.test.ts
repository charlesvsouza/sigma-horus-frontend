import test from 'node:test';
import assert from 'node:assert/strict';
import { asaasBaseUrl, isWebhookAuthorized, processWebhook } from './asaas.ts';

test('webhook is authorized when the lodge has no token (sandbox/setup)', () => {
  assert.equal(isWebhookAuthorized('anything', null), true);
  assert.equal(isWebhookAuthorized(null, undefined), true);
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
