import test from 'node:test';
import assert from 'node:assert/strict';
import { bankCredentialsHint, openBankCredentials, sealBankCredentials } from './bank-credentials.ts';

process.env.AUTH_SECRET ??= 'segredo-de-teste';

const creds = { clientId: ' abc-1234 ', clientSecret: 'seg-0000-1111', certificatePem: '-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----\n', privateKeyPem: '-----BEGIN PRIVATE KEY-----\nBBB\n-----END PRIVATE KEY-----\n' };

test('credenciais vão cifradas e voltam iguais (sem espaços nas pontas)', () => {
  const sealed = sealBankCredentials(creds);
  for (const v of Object.values(sealed)) {
    assert.match(v, /^v1:/);
    assert.ok(!v.includes('abc-1234') && !v.includes('seg-0000') && !v.includes('BEGIN'));
  }
  const opened = openBankCredentials(sealed);
  assert.equal(opened?.clientId, 'abc-1234');
  assert.equal(opened?.clientSecret, 'seg-0000-1111');
  assert.equal(opened?.certificatePem, creds.certificatePem.trim());
  assert.equal(opened?.privateKeyPem, creds.privateKeyPem.trim());
});

test('faltando qualquer peça ou dado corrompido, não abre', () => {
  const sealed = sealBankCredentials(creds);
  assert.equal(openBankCredentials(null), null);
  assert.equal(openBankCredentials({ ...sealed, privateKeyEnc: null }), null);
  assert.equal(openBankCredentials({ ...sealed, clientSecretEnc: 'v1:x:y:z' }), null);
});

test('dica mostra só os 4 últimos do client_id', () => {
  const sealed = sealBankCredentials(creds);
  assert.equal(bankCredentialsHint(sealed), '••••1234');
  assert.equal(bankCredentialsHint(null), null);
});
