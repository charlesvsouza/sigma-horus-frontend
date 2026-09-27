import test from 'node:test';
import assert from 'node:assert/strict';
import { debtBalance, declarationNumber, evaluateGoodStanding } from './good-standing.ts';

// 27/09/2026 10:00 em Brasília.
const NOW = new Date('2026-09-27T13:00:00Z');
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

test('regular: sem nada vencido — conta a vencer (ou que vence hoje) não impede', () => {
  const s = evaluateGoodStanding([
    { title: 'Mensalidades', dueDate: d('2026-09-27'), balance: 110 },
    { title: 'Mensalidades', dueDate: d('2026-10-05'), balance: 110 },
    { title: 'Evento', dueDate: d('2026-08-01'), balance: 0 }, // já quitada
  ], NOW);
  assert.equal(s.regular, true);
  assert.deepEqual(s.overdue, []);
  assert.equal(s.upcomingTotal, 220);
});

test('irregular: lista o que venceu, do mais antigo, com dias e total em centavos', () => {
  const s = evaluateGoodStanding([
    { title: 'Mensalidades', dueDate: d('2026-09-05'), balance: 10.1 },
    { title: 'Material', dueDate: d('2026-07-10'), balance: 20.2 },
    { title: 'Mensalidades', dueDate: d('2026-10-05'), balance: 110 },
  ], NOW);
  assert.equal(s.regular, false);
  assert.deepEqual(s.overdue.map((o) => [o.title, o.days]), [['Material', 79], ['Mensalidades', 22]]);
  assert.equal(s.overdueTotal, 30.3);
  assert.equal(s.upcomingTotal, 110);
});

test('saldo desconta parciais; número da declaração no dia de Brasília', () => {
  assert.equal(debtBalance(30.3, [10.1, 10.1]), 10.1);
  assert.equal(debtBalance(110, [120]), 0);
  // 23h de 27/09 em Brasília (já 28/09 em UTC) ainda numera como dia 27.
  assert.equal(declarationNumber('cmabcdef123456', new Date('2026-09-28T02:00:00Z')), '20260927-123456');
});
