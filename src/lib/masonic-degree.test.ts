import test from 'node:test';
import assert from 'node:assert/strict';
import { degreeRank, isEligibleForDegree, timeInOrderLabel, yearsInOrder } from './masonic-degree.ts';

test('degreeRank: ordem crescente Aprendiz < Companheiro < Mestre < Mestre Instalado', () => {
  assert.ok(degreeRank('Aprendiz') < degreeRank('Companheiro'));
  assert.ok(degreeRank('Companheiro') < degreeRank('Mestre'));
  assert.ok(degreeRank('Mestre') < degreeRank('Mestre Instalado'));
});

test('degreeRank: null/vazio vale 0', () => {
  assert.equal(degreeRank(null), 0);
  assert.equal(degreeRank(undefined), 0);
});

test('isEligibleForDegree: sem grau exigido, todo mundo é elegível', () => {
  assert.equal(isEligibleForDegree(null, null), true);
  assert.equal(isEligibleForDegree('Aprendiz', null), true);
});

test('isEligibleForDegree: Aprendiz não é elegível a material de Companheiro', () => {
  assert.equal(isEligibleForDegree('Aprendiz', 'Companheiro'), false);
});

test('isEligibleForDegree: Mestre Instalado é elegível a material de grau inferior já cursado', () => {
  assert.equal(isEligibleForDegree('Mestre Instalado', 'Aprendiz'), true);
  assert.equal(isEligibleForDegree('Mestre Instalado', 'Companheiro'), true);
  assert.equal(isEligibleForDegree('Mestre Instalado', 'Mestre'), true);
});

test('isEligibleForDegree: membro sem situação simbólica (null) não é elegível a nada que exija grau', () => {
  assert.equal(isEligibleForDegree(null, 'Aprendiz'), false);
});

// Datas só-dia (00:00 UTC) + "hoje" em Brasília: mesmo resultado no servidor (UTC) e no navegador (UTC-3).
test('yearsInOrder: no dia exato do aniversário (Brasília) já conta o ano, sem deslocar um dia', () => {
  const init = new Date('2000-10-03T00:00:00Z');
  assert.equal(yearsInOrder(init, new Date('2026-10-03T12:00:00Z')), 26); // 09:00 de 03/10 em Brasília
  assert.equal(yearsInOrder(init, new Date('2026-10-03T02:00:00Z')), 25); // ainda 02/10, 23:00 em Brasília
});
test('timeInOrderLabel: marco no dia 1º não perde nem ganha um mês', () => {
  const init = new Date('2000-11-01T00:00:00Z');
  assert.equal(timeInOrderLabel(init, new Date('2001-01-01T12:00:00Z')), '2 meses');
});
