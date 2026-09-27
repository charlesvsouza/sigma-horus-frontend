import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateGroupPayment, isGroupRef } from './asaas-group.ts';

const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x * 100, 0)) / 100;

test('referência do grupo', () => {
  assert.equal(isGroupRef('grp:abc'), true);
  assert.equal(isGroupRef('cmabc'), false);
  assert.equal(isGroupRef(null), false);
});

test('divide na ordem, cada uma até o que falta; a soma bate em centavos', () => {
  const a = allocateGroupPayment([{ invoiceId: 'a', open: 110 }, { invoiceId: 'b', open: 110 }, { invoiceId: 'c', open: 30.3 }], 250.3, null);
  assert.deepEqual(a, [
    { invoiceId: 'a', amount: 110, netValue: null },
    { invoiceId: 'b', amount: 110, netValue: null },
    { invoiceId: 'c', amount: 30.3, netValue: null },
  ]);
});

test('tarifa rateada na proporção, arredondamento na última; líquido total = líquido do Asaas', () => {
  const a = allocateGroupPayment([{ invoiceId: 'a', open: 100 }, { invoiceId: 'b', open: 50 }, { invoiceId: 'c', open: 50 }], 200, 198.01);
  assert.deepEqual(a.map((x) => x.amount), [100, 50, 50]);
  assert.equal(sum(a.map((x) => x.netValue ?? 0)), 198.01);
  assert.equal(sum(a.map((x) => x.amount - (x.netValue ?? 0))), 1.99);
  assert.equal(a[0].netValue, 99); // tarifa 0,995 → 1,00 na primeira parte (metade do valor)
});

test('pagou a mais: a sobra vai para a última; pagou a menos: as últimas ficam sem parte', () => {
  const over = allocateGroupPayment([{ invoiceId: 'a', open: 110 }, { invoiceId: 'b', open: 110 }], 230, null);
  assert.deepEqual(over.map((x) => [x.invoiceId, x.amount]), [['a', 110], ['b', 120]]);
  const under = allocateGroupPayment([{ invoiceId: 'a', open: 110 }, { invoiceId: 'b', open: 110 }, { invoiceId: 'c', open: 110 }], 150, null);
  assert.deepEqual(under.map((x) => [x.invoiceId, x.amount]), [['a', 110], ['b', 40]]);
  assert.deepEqual(allocateGroupPayment([], 100, null), []);
});
