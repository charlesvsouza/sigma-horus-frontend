import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDue, monthRange, parseMonth, summarizePunctuality } from './dues-punctuality.ts';

const TODAY = '2026-10-15';

test('paga no próprio dia do vencimento é em dia; depois é atrasada', () => {
  assert.equal(classifyDue({ status: 'paid', dueDay: '2026-10-10', paidDay: '2026-10-10' }, TODAY), 'on_time');
  assert.equal(classifyDue({ status: 'paid', dueDay: '2026-10-10', paidDay: '2026-10-05' }, TODAY), 'on_time');
  assert.equal(classifyDue({ status: 'paid', dueDay: '2026-10-10', paidDay: '2026-10-11' }, TODAY), 'late');
});

test('aberta: vencida só depois do dia do vencimento; cancelada fica fora', () => {
  assert.equal(classifyDue({ status: 'pending', dueDay: '2026-10-15', paidDay: null }, TODAY), 'open_upcoming');
  assert.equal(classifyDue({ status: 'pending', dueDay: '2026-10-14', paidDay: null }, TODAY), 'open_overdue');
  assert.equal(classifyDue({ status: 'cancelled', dueDay: '2026-10-01', paidDay: null }, TODAY), null);
});

test('resumo: percentuais inteiros somam 100 e agrupam pagas/não pagas', () => {
  const s = summarizePunctuality(['on_time', 'on_time', 'late', 'open_overdue', 'open_upcoming', 'open_upcoming', null]);
  assert.equal(s.total, 6);
  assert.deepEqual(s.counts, { on_time: 2, late: 1, open_overdue: 1, open_upcoming: 2 });
  assert.equal(Object.values(s.percent).reduce((a, b) => a + b, 0), 100);
  assert.equal(s.paid.count, 3);
  assert.equal(s.unpaid.count, 3);
  assert.equal(s.paid.percent + s.unpaid.percent, 100);
  assert.equal(summarizePunctuality([]).paid.percent, 0);
});

test('mês: valida o formato e calcula o intervalo', () => {
  assert.equal(parseMonth('2026-09', TODAY), '2026-09');
  assert.equal(parseMonth('2026-13', TODAY), '2026-10');
  assert.equal(parseMonth(null, TODAY), '2026-10');
  const r = monthRange('2026-12');
  assert.equal(r.start.toISOString(), '2026-12-01T00:00:00.000Z');
  assert.equal(r.end.toISOString(), '2027-01-01T00:00:00.000Z');
});
