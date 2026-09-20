import test from 'node:test';
import assert from 'node:assert/strict';
import { coversAmount, hasAtMostCents, isValidMoney, remainingAmount, round2, sumMoney } from './money.ts';

test('o caso que quebrava: 10,10 + 20,20 cobre 30,30', () => {
  assert.equal(10.1 + 20.2 >= 30.3, false); // a soma crua falha
  assert.equal(coversAmount(sumMoney([10.1, 20.2]), 30.3), true);
  assert.equal(coversAmount(10.1 + 20.2, 30.3), true); // e a comparação em centavos absorve o erro
});

test('soma em centavos não acumula erro', () => {
  assert.equal(sumMoney([0.1, 0.2]), 0.3);
  assert.equal(sumMoney(Array.from({ length: 10 }, () => 0.1)), 1);
  assert.equal(sumMoney([]), 0);
});

test('cobertura: falta 1 centavo não cobre', () => {
  assert.equal(coversAmount(99.98, 99.99), false);
  assert.equal(coversAmount(99.99, 99.99), true);
  assert.equal(coversAmount(100, 99.99), true);
});

test('saldo em aberto nunca é negativo e sem resíduo de float', () => {
  assert.equal(remainingAmount(30.3, 10.1), 20.2);
  assert.equal(remainingAmount(50, 50), 0);
  assert.equal(remainingAmount(50, 60), 0);
});

test('round2', () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(2.675), 2.68);
  assert.equal(round2(0.1 + 0.2), 0.3);
});

test('valor válido: positivo, finito, até 2 casas', () => {
  for (const ok of [0.01, 1, 40, 99.99, 1234.5]) assert.equal(isValidMoney(ok), true, String(ok));
  for (const bad of [0, -5, NaN, Infinity, 1.005, 1e13, '10', null, undefined]) assert.equal(isValidMoney(bad), false, String(bad));
});

test('hasAtMostCents aceita até 2 casas e tolera ruído de ponto flutuante', () => {
  for (const n of [0, 10, 10.5, 10.55, -7.25, 0.1 * 3, 0.1 + 0.2, 1e12]) assert.equal(hasAtMostCents(n), true, String(n));
});

test('hasAtMostCents recusa 3+ casas, NaN, Infinity e valor grande demais', () => {
  for (const n of [10.123, 0.001, -5.555, NaN, Infinity, -Infinity, 1e12 + 1]) assert.equal(hasAtMostCents(n), false, String(n));
});

test('isValidMoney continua exigindo valor positivo', () => {
  assert.equal(isValidMoney(0), false);
  assert.equal(isValidMoney(-1), false);
  assert.equal(isValidMoney(10.123), false);
  assert.equal(isValidMoney('10'), false);
  assert.equal(isValidMoney(10.1), true);
});
