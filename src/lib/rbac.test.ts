import test from 'node:test';
import assert from 'node:assert/strict';
import { MATRIX_ROLES, ROLES, canAccess, canAccessAny, cargoRoleForOffice } from './rbac.ts';

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

test('Arquiteto (papel por cargo): opera o inventário, lê o cadastro, não edita nem vê dinheiro', () => {
  assert.equal(canAccess('architect', 'inventory', 'write'), true);
  assert.equal(canAccess('architect', 'inventory', 'read'), true);
  assert.equal(canAccess('architect', 'materials', 'read'), true);
  assert.equal(canAccess('architect', 'materials', 'write'), false); // não decide baixa/reposição
  for (const resource of ['accounts', 'members', 'documents', 'messages', 'import', 'audit'] as const) {
    assert.equal(canAccess('architect', resource, 'read'), false, resource);
  }
});

test('Arquiteto é papel por cargo: não é atribuível em Usuários & acessos', () => {
  assert.equal((ROLES as readonly string[]).includes('architect'), false);
  assert.equal(MATRIX_ROLES.includes('architect'), true);
});

test('cargo → papel: só "Arquiteto" (sem acento/caixa) concede o papel', () => {
  assert.equal(cargoRoleForOffice('Arquiteto'), 'architect');
  assert.equal(cargoRoleForOffice('  arquiteto '), 'architect');
  assert.equal(cargoRoleForOffice('ARQUITETO'), 'architect');
  for (const name of ['Secretário', 'Venerável Mestre', 'Guarda do Templo', 'Arquiteto-Adjunto']) {
    assert.equal(cargoRoleForOffice(name), null, name);
  }
});

test('materiais: Administrador, Venerável e Secretário cadastram; Tesoureiro/Hospitaleiro/Membro não', () => {
  for (const role of ['admin', 'venerable', 'secretary']) {
    assert.equal(canAccess(role, 'materials', 'write'), true, role);
    assert.equal(canAccess(role, 'inventory', 'write'), true, role);
  }
  for (const role of ['treasurer', 'hospitaller', 'member']) {
    assert.equal(canAccess(role, 'materials', 'write'), false, role);
    assert.equal(canAccess(role, 'inventory', 'write'), false, role);
  }
});
