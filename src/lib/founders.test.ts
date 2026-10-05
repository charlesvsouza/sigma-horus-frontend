import test from 'node:test';
import assert from 'node:assert/strict';
import { foundersDaysLeft, foundersSlotsLeft } from './founders.ts';

const END = new Date('2026-10-28T10:12:19.822Z'); // fim do teste da amm139 (28/10, manhã em Brasília)

test('dias restantes contam pelo dia de Brasília e caem um por dia', () => {
  assert.equal(foundersDaysLeft(END, new Date('2026-10-05T15:00:00Z')), 23);
  assert.equal(foundersDaysLeft(END, new Date('2026-10-06T02:30:00Z')), 23, '23h30 de 05/10 em Brasília ainda é o dia 05');
  assert.equal(foundersDaysLeft(END, new Date('2026-10-06T03:30:00Z')), 22, '00h30 de 06/10 em Brasília já é o dia 06');
  assert.equal(foundersDaysLeft(END, new Date('2026-10-27T15:00:00Z')), 1);
  assert.equal(foundersDaysLeft(END, new Date('2026-10-28T15:00:00Z')), 0);
  assert.equal(foundersDaysLeft(END, new Date('2026-10-29T15:00:00Z')), -1);
});

test('vagas = dias restantes (no máximo 30) menos assinaturas pagas, nunca negativo', () => {
  assert.equal(foundersSlotsLeft(23, 0), 23);
  assert.equal(foundersSlotsLeft(23, 2), 21);
  assert.equal(foundersSlotsLeft(60, 0), 30);
  assert.equal(foundersSlotsLeft(3, 5), 0);
  assert.equal(foundersSlotsLeft(0, 0), 0);
});
