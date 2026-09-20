import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ADMINS, checkAdminCap, checkRoleChange, normalizeEmail } from './admin-policy.ts';
import { canAccess } from './rbac.ts';
import { readEmailChangeToken, signEmailChangeToken, verifyEmailChangeToken } from './email-change-token.ts';

test('ninguém é promovido a Administrador', () => {
  for (const from of ['member', 'venerable', 'treasurer', 'secretary', 'hospitaller']) {
    const r = checkRoleChange(from, 'admin');
    assert.equal(r.ok, false, `${from} → admin deveria ser recusado`);
  }
});

test('o Administrador também não é rebaixado', () => {
  for (const to of ['member', 'venerable', 'treasurer', 'secretary', 'hospitaller']) {
    assert.equal(checkRoleChange('admin', to).ok, false);
  }
});

test('trocas entre os demais papéis e "sem mudança" continuam livres', () => {
  assert.equal(checkRoleChange('member', 'treasurer').ok, true);
  assert.equal(checkRoleChange('venerable', 'secretary').ok, true);
  assert.equal(checkRoleChange('admin', 'admin').ok, true);
});

test('teto de 2 Administradores ativos', () => {
  assert.equal(MAX_ADMINS, 2);
  assert.equal(checkAdminCap(0).ok, true);
  assert.equal(checkAdminCap(1).ok, true);
  assert.equal(checkAdminCap(2).ok, false);
  assert.equal(checkAdminCap(3).ok, false);
});

test('normalizeEmail ignora caixa e espaços', () => {
  assert.equal(normalizeEmail('  Fulano@Exemplo.COM '), 'fulano@exemplo.com');
  assert.equal(normalizeEmail(null), '');
});

test('a matriz de permissões nunca restringe o Administrador (padrão fixo)', () => {
  assert.equal(canAccess('admin', 'accounts', 'write'), true);
  assert.equal(canAccess('admin', 'members', 'write'), true);
  assert.equal(canAccess('admin', 'import', 'write'), true);
});

test('token de troca de e-mail: válido, expira, e é invalidado por troca de senha', () => {
  process.env.AUTH_SECRET = 'segredo-de-teste';
  const t0 = 1_000_000;
  const token = signEmailChangeToken('u1', 'Novo@Exemplo.com', 'hash-antigo', t0);
  assert.deepEqual(readEmailChangeToken(token), { userId: 'u1', newEmail: 'novo@exemplo.com' });
  assert.equal(verifyEmailChangeToken(token, 'hash-antigo', t0 + 1000), true);
  assert.equal(verifyEmailChangeToken(token, 'hash-antigo', t0 + 61 * 60_000), false, 'expira em 1h');
  assert.equal(verifyEmailChangeToken(token, 'hash-novo', t0 + 1000), false, 'trocar a senha invalida o link');
  const forged = token.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
  assert.equal(verifyEmailChangeToken(forged, 'hash-antigo', t0 + 1000), false);
});
