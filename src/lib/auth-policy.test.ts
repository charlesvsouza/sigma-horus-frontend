import test from 'node:test';
import assert from 'node:assert/strict';
import { isAccountUsable, isLockedOut, LOGIN_MAX_FAILURES } from './auth-policy.ts';

test('usuário ativo de loja ativa pode entrar', () => {
  assert.equal(isAccountUsable({ status: 'active' }, { status: 'active' }), true);
});

test('usuário desativado NÃO entra', () => {
  assert.equal(isAccountUsable({ status: 'inactive' }, { status: 'active' }), false);
});

test('loja encerrada/expurgada NÃO entra', () => {
  assert.equal(isAccountUsable({ status: 'active' }, { status: 'purged' }), false);
  assert.equal(isAccountUsable({ status: 'active' }, null), false);
});

test('usuário inexistente NÃO entra', () => {
  assert.equal(isAccountUsable(null, { status: 'active' }), false);
  assert.equal(isAccountUsable(undefined, undefined), false);
});

test('trava por força bruta só a partir do limite', () => {
  assert.equal(isLockedOut(0), false);
  assert.equal(isLockedOut(LOGIN_MAX_FAILURES - 1), false);
  assert.equal(isLockedOut(LOGIN_MAX_FAILURES), true);
  assert.equal(isLockedOut(LOGIN_MAX_FAILURES + 5), true);
});
