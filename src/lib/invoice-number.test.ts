import test from 'node:test';
import assert from 'node:assert/strict';
import { nextSequenceNumbers } from './invoice-number.ts';

const P = 'COB-202609-';

test('série vazia começa em 0001', () => {
  assert.deepEqual(nextSequenceNumbers(P, [], 2), ['COB-202609-0001', 'COB-202609-0002']);
});

test('continua depois do maior número', () => {
  assert.deepEqual(nextSequenceNumbers(P, [`${P}0001`, `${P}0002`], 1), ['COB-202609-0003']);
});

test('cobrança apagada no meio não faz repetir número (contar repetiria o 0003)', () => {
  // existiam 0001, 0002, 0003; a 0002 foi apagada → contar daria 3 (colisão com o 0003).
  assert.deepEqual(nextSequenceNumbers(P, [`${P}0001`, `${P}0003`], 1), ['COB-202609-0004']);
});

test('ignora outro mês, outro prefixo e números digitados à mão', () => {
  const existing = ['COB-202608-0099', 'DOA-202609-0050', `${P}manual`, `${P}0007-D2`, `${P}0002`];
  assert.deepEqual(nextSequenceNumbers(P, existing, 1), ['COB-202609-0003']);
});

test('passa de 9999 sem cortar o número', () => {
  assert.deepEqual(nextSequenceNumbers(P, [`${P}9999`], 1), ['COB-202609-10000']);
});
