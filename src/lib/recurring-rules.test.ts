import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addInterval, isHeldForArt002, isLegacyGeneratedNumber, pendingOccurrences } from './recurring-rules';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

test('addInterval: mensal, trimestral e anual', () => {
  assert.equal(iso(addInterval(d('2026-09-10'), 'monthly')), '2026-10-10');
  assert.equal(iso(addInterval(d('2026-09-10'), 'quarterly')), '2026-12-10');
  assert.equal(iso(addInterval(d('2026-09-10'), 'yearly')), '2027-09-10');
  assert.equal(iso(addInterval(d('2026-12-10'), 'monthly')), '2027-01-10');
});

test('addInterval: não estoura o fim do mês (31/jan → 28/fev, não 03/mar)', () => {
  assert.equal(iso(addInterval(d('2026-01-31'), 'monthly')), '2026-02-28');
  assert.equal(iso(addInterval(d('2028-01-31'), 'monthly')), '2028-02-29');
  assert.equal(iso(addInterval(d('2028-02-29'), 'yearly')), '2029-02-28');
});

test('pendingOccurrences: nada quando a próxima data ainda é futura', () => {
  assert.deepEqual(pendingOccurrences(d('2026-10-10'), 'monthly', null, d('2026-09-19')), []);
});

test('pendingOccurrences: no dia do vencimento já conta', () => {
  assert.deepEqual(pendingOccurrences(d('2026-09-19'), 'monthly', null, d('2026-09-19')).map(iso), ['2026-09-19']);
});

test('pendingOccurrences: acumulado de meses parados, da mais antiga para a mais nova', () => {
  const r = pendingOccurrences(d('2026-06-10'), 'monthly', null, d('2026-09-19')).map(iso);
  assert.deepEqual(r, ['2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10']);
});

test('pendingOccurrences: respeita quantas ocorrências faltam', () => {
  const r = pendingOccurrences(d('2026-06-10'), 'monthly', 2, d('2026-09-19')).map(iso);
  assert.deepEqual(r, ['2026-06-10', '2026-07-10']);
  assert.deepEqual(pendingOccurrences(d('2026-06-10'), 'monthly', 0, d('2026-09-19')), []);
});

test('pendingOccurrences: a trava impede laço enorme', () => {
  assert.equal(pendingOccurrences(d('2000-01-10'), 'monthly', null, d('2026-09-19'), 12).length, 12);
});

test('isHeldForArt002: situação art_002 retém mesmo sem dias em atraso', () => {
  assert.equal(isHeldForArt002({ status: 'art_002' }, null, true, 60), true);
  assert.equal(isHeldForArt002({ status: 'art_002' }, 0, false, 60), true);
});

test('isHeldForArt002: enquadrado pela regra dos 60 dias mesmo com a situação ainda "active"', () => {
  assert.equal(isHeldForArt002({ status: 'active' }, 61, true, 60), true);
  assert.equal(isHeldForArt002({ status: 'active' }, 60, true, 60), false);
  assert.equal(isHeldForArt002({ status: 'active' }, null, true, 60), false);
});

test('isHeldForArt002: com o Art. 002 desligado na loja, só a situação manual retém', () => {
  assert.equal(isHeldForArt002({ status: 'active' }, 200, false, 60), false);
});

test('isLegacyGeneratedNumber: reconhece o sufixo do código antigo e não o número normal', () => {
  assert.equal(isLegacyGeneratedNumber('COB-202609-0001-1758300000000'), true);
  assert.equal(isLegacyGeneratedNumber('COB-202609-0001-1758300000000-1758400000000'), true);
  assert.equal(isLegacyGeneratedNumber('COB-202609-0001'), false);
  assert.equal(isLegacyGeneratedNumber('MENS-2026'), false);
});
