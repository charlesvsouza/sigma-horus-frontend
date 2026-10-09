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

test('Financeiro (Contas e relatórios): Administrador, Venerável, Tesoureiro e Hospitaleiro (Tronco) leem; Secretário não', () => {
  for (const role of ['admin', 'venerable', 'treasurer', 'hospitaller']) {
    assert.equal(canAccess(role, 'accounts', 'read'), true, role);
  }
  for (const role of ['secretary', 'member']) {
    assert.equal(canAccess(role, 'accounts', 'read'), false, role);
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

test('Social: todo papel enxerga os quadros, mas ninguém ganha o cadastro de membros por isso', () => {
  for (const role of ['admin', 'venerable', 'treasurer', 'secretary', 'hospitaller', 'member']) {
    assert.equal(canAccess(role, 'social', 'read'), true, role);
    assert.equal(canAccess(role, 'social', 'write'), false, role); // os quadros são só leitura
  }
  // O obreiro comum continua SEM ler o cadastro de membros (CPF, contatos, situação)
  assert.equal(canAccess('member', 'members', 'read'), false);
  assert.equal(canAccess('member', 'accounts', 'read'), false);
});

test('Chanceler (papel por cargo): opera presença e visitantes, não vê o cadastro dos irmãos nem o financeiro', () => {
  assert.equal(canAccess('chancellor', 'attendance', 'read'), true);
  assert.equal(canAccess('chancellor', 'attendance', 'write'), true);
  for (const resource of ['members', 'accounts', 'documents', 'messages', 'import', 'audit', 'materials', 'inventory'] as const) {
    assert.equal(canAccess('chancellor', resource, 'read'), false, resource);
  }
  assert.equal((ROLES as readonly string[]).includes('chancellor'), false);
  assert.equal(MATRIX_ROLES.includes('chancellor'), true);
  assert.equal(cargoRoleForOffice('Chanceler'), 'chancellor');
  assert.equal(cargoRoleForOffice('  CHANCELER '), 'chancellor');
});

test('Chancelaria sem prejuízo do Secretário: quem já cuidava da presença continua com o acesso', () => {
  for (const role of ['admin', 'venerable', 'secretary']) {
    assert.equal(canAccess(role, 'attendance', 'read'), true, role);
    assert.equal(canAccess(role, 'attendance', 'write'), true, role);
  }
  for (const role of ['treasurer', 'member', 'hospitaller']) assert.equal(canAccess(role, 'attendance', 'write'), false, role);
});
