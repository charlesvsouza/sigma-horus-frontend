import test from 'node:test';
import assert from 'node:assert/strict';
import { ehRelatorioDoTronco, naOrdemRecente } from './category-ledger-order.ts';

test('filtro do fundo Tronco pede ordem recente', () => {
  assert.equal(ehRelatorioDoTronco('tronco', []), true);
  assert.equal(ehRelatorioDoTronco('tronco', [{ fundPurpose: 'donations' }]), true);
});

test('só categorias do Tronco marcadas também pedem ordem recente', () => {
  assert.equal(ehRelatorioDoTronco(undefined, [{ fundPurpose: 'tronco' }]), true);
  assert.equal(ehRelatorioDoTronco(undefined, [{ isSolidarity: true }, { fundPurpose: 'tronco' }]), true);
});

test('razão comum (mensalidades, doações, mistura) segue cronológico', () => {
  assert.equal(ehRelatorioDoTronco(undefined, []), false);
  assert.equal(ehRelatorioDoTronco(undefined, [{ fundPurpose: 'donations' }]), false);
  assert.equal(ehRelatorioDoTronco(undefined, [{ fundPurpose: 'tronco' }, { fundPurpose: 'dues' }]), false);
  assert.equal(ehRelatorioDoTronco('donations', [{ fundPurpose: 'tronco' }]), false);
});

test('naOrdemRecente inverte só quando pedido e não muta a lista original', () => {
  const original = [1, 2, 3];
  assert.deepEqual(naOrdemRecente(original, true), [3, 2, 1]);
  assert.deepEqual(original, [1, 2, 3]);
  assert.deepEqual(naOrdemRecente(original, false), [1, 2, 3]);
});
