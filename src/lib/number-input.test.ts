import test from 'node:test';
import assert from 'node:assert/strict';
import { intInRange } from './number-input.ts';

test('inteiro dentro da faixa passa (número ou texto); o resto vira null', () => {
  assert.equal(intInRange(12, 1, 600), 12);
  assert.equal(intInRange('12', 1, 600), 12);
  assert.equal(intInRange(0, 1, 600), null);
  assert.equal(intInRange(601, 1, 600), null);
  assert.equal(intInRange(1.5, 1, 600), null);
  assert.equal(intInRange(1e10, 1, 600), null);
  assert.equal(intInRange(Number.NaN, 1, 600), null);
  assert.equal(intInRange('', 1, 600), null);
  assert.equal(intInRange('abc', 1, 600), null);
  assert.equal(intInRange(null, 1, 600), null);
  assert.equal(intInRange(undefined, 1, 600), null);
  assert.equal(intInRange(Infinity, 1, 600), null);
});
