import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret, maskSecret } from './crypto.ts';

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-for-crypto';

test('encrypt/decrypt roundtrip recovers the original secret', () => {
  const secret = '$aact_prod_000xyzApiKey123456789';
  const encrypted = encryptSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.match(encrypted, /^v1:/);
  assert.equal(decryptSecret(encrypted), secret);
});

test('decryptSecret returns null for invalid input', () => {
  assert.equal(decryptSecret(null), null);
  assert.equal(decryptSecret('not-encrypted'), null);
  assert.equal(decryptSecret('v1:bad:data:here'), null);
});

test('maskSecret only reveals the last 4 chars', () => {
  assert.equal(maskSecret('abcdef1234'), '••••1234');
  assert.equal(maskSecret('abc'), '••••');
});
