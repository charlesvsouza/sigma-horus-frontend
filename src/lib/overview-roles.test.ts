import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERVIEW_NAV_ROLES, birthdayWithin, overviewRole, overviewScope } from './overview-roles.ts';

test('Visão geral só para cargos de gestão; obreiro comum e candidato ficam com o portal', () => {
  for (const r of ['admin', 'venerable', 'treasurer', 'secretary', 'hospitaller']) assert.ok(overviewScope(r), r);
  for (const r of ['member', 'candidate', 'architect', '', null, undefined, 'hacker']) assert.equal(overviewScope(r), null, String(r));
  assert.equal(overviewRole(' Treasurer '), 'treasurer');
  assert.deepEqual(OVERVIEW_NAV_ROLES.sort(), ['admin', 'hospitaller', 'secretary', 'treasurer', 'venerable']);
});

test('cada cargo na sua área: financeiro só para Administrador, Venerável e Tesoureiro', () => {
  assert.equal(overviewScope('secretary')!.finance, false);
  assert.equal(overviewScope('hospitaller')!.finance, false);
  assert.equal(overviewScope('treasurer')!.finance, true);
  // visto de despesas: Venerável e Administrador; Tesoureiro não aprova a própria despesa
  assert.deepEqual(['admin', 'venerable', 'treasurer'].map((r) => overviewScope(r)!.approvals), [true, true, false]);
  // faltas seguidas: Venerável, Secretário, Hospitaleiro e Administrador; Tesoureiro não
  assert.deepEqual(['admin', 'venerable', 'treasurer', 'secretary', 'hospitaller'].map((r) => overviewScope(r)!.attendance), [true, true, false, true, true]);
  // conciliação e recorrências: operação do Tesoureiro (e do Administrador)
  assert.deepEqual(['admin', 'venerable', 'treasurer'].map((r) => overviewScope(r)!.treasury), [true, false, true]);
  // Art. 002 e acordos: Tesoureiro também vê (precisa ver o acordo)
  assert.equal(overviewScope('treasurer')!.compliance, true);
  assert.equal(overviewScope('secretary')!.compliance, false);
  // assinatura só do Administrador
  assert.deepEqual(['admin', 'venerable', 'treasurer', 'secretary', 'hospitaller'].map((r) => overviewScope(r)!.system), [true, false, false, false, false]);
});

test('aniversariantes dos próximos 7 dias (virada de mês incluída)', () => {
  const today = new Date('2026-12-28T00:00:00.000Z');
  assert.equal(birthdayWithin(new Date('1980-12-28T00:00:00Z'), today), true);   // hoje
  assert.equal(birthdayWithin(new Date('1975-01-02T00:00:00Z'), today), true);   // virada do ano, dia 6
  assert.equal(birthdayWithin(new Date('1990-01-05T00:00:00Z'), today), false);  // dia 8: fora
  assert.equal(birthdayWithin(new Date('1990-12-27T00:00:00Z'), today), false);  // ontem
});
