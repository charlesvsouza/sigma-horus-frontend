import test from 'node:test';
import assert from 'node:assert/strict';
import { degreeRank, isEligibleForDegree } from './masonic-degree.ts';

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
