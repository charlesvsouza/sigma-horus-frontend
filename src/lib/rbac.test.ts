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
