import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccess, canAccessAny } from './rbac.ts';

test('allows admins to manage core resources', () => {
  assert.equal(canAccess('admin', 'members', 'write'), true);
  assert.equal(canAccess('admin', 'documents', 'read'), true);
});

test('allows role-based bulk checks for portal and finances', () => {
  assert.equal(canAccessAny('treasurer', ['accounts', 'portal'], 'read'), true);
  assert.equal(canAccessAny('member', ['members', 'accounts'], 'read'), false);
});

test('auditoria: só o Administrador por padrão; outros cargos só se o Admin liberar', () => {
  assert.equal(canAccess('admin', 'audit', 'read'), true);
  for (const role of ['venerable', 'treasurer', 'secretary', 'hospitaller', 'member']) {
    assert.equal(canAccess(role, 'audit', 'read'), false, role);
  }
});

test('cada cargo fica na sua área: escrita em Contas só Administrador e Tesoureiro', () => {
  assert.equal(canAccess('treasurer', 'accounts', 'write'), true);
  for (const role of ['venerable', 'secretary', 'hospitaller', 'member']) {
    assert.equal(canAccess(role, 'accounts', 'write'), false, role);
  }
});
