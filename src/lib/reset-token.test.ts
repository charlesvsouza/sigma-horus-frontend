import test from 'node:test';
import assert from 'node:assert/strict';
import { readResetTokenUser, RESET_TOKEN_TTL_MS, signResetToken, verifyResetToken } from './reset-token.ts';

process.env.AUTH_SECRET = 'segredo-de-teste';
const HASH = '$2a$10$hashDaSenhaAtualDoUsuario';

test('token válido é aceito e identifica o usuário', () => {
  const t = signResetToken('user_1', HASH, 1_000);
  assert.equal(readResetTokenUser(t), 'user_1');
  assert.equal(verifyResetToken(t, HASH, 1_000 + 1000), true);
});

test('token expira depois da validade', () => {
  const t = signResetToken('user_1', HASH, 1_000);
  assert.equal(verifyResetToken(t, HASH, 1_000 + RESET_TOKEN_TTL_MS), true);
  assert.equal(verifyResetToken(t, HASH, 1_000 + RESET_TOKEN_TTL_MS + 1), false);
});

test('token é de uso único: deixa de valer quando a senha muda', () => {
  const t = signResetToken('user_1', HASH, 1_000);
  assert.equal(verifyResetToken(t, '$2a$10$outraSenhaNova', 2_000), false);
});

test('token adulterado (troca do usuário ou da assinatura) é recusado', () => {
  const t = signResetToken('user_1', HASH, 1_000);
  const [payload, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'user_2', e: 9_999_999_999_999 })).toString('base64url');
  assert.equal(verifyResetToken(`${forged}.${sig}`, HASH, 2_000), false);
  assert.equal(verifyResetToken(`${payload}.${sig.slice(0, -2)}xx`, HASH, 2_000), false);
});

test('lixo não quebra a verificação', () => {
  for (const junk of ['', 'abc', 'a.b', '....', '%%%.%%%']) {
    assert.equal(verifyResetToken(junk, HASH), false);
    assert.equal(readResetTokenUser(junk) === null || typeof readResetTokenUser(junk) === 'string', true);
  }
});
