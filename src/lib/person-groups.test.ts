import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByPerson } from './person-groups.ts';

const o = { key: (r: { p: string | null }) => r.p, name: (r: { p: string | null }) => r.p ?? '', amount: (r: { a: number }) => r.a, date: (r: { d: string }) => r.d };
const R = (id: string, p: string | null, d: string, a = 10) => ({ id, p, d, a });

test('groupByPerson: acumulado junta quem tem mais de um lançamento, do mais antigo ao mais novo', () => {
  const rows = [R('1', 'A', '2026-02-01'), R('2', 'B', '2026-02-02'), R('3', 'A', '2026-01-01', 5.1), R('4', null, '2026-03-01')];
  const e = groupByPerson(rows, o as never, true);
  assert.equal(e.length, 3);
  const g = e[0];
  assert.ok(g.kind === 'group');
  assert.deepEqual(g.rows.map((r) => r.id), ['3', '1']);
  assert.equal(g.total, 15.1);
  assert.equal(g.oldest, '2026-01-01');
  assert.ok(e[1].kind === 'row' && e[1].row.id === '2');
});

test('groupByPerson: sem acumular, os lançamentos da pessoa ficam juntos e em ordem de data', () => {
  const rows = [R('1', 'A', '2026-02-01'), R('2', 'B', '2026-02-02'), R('3', 'A', '2026-01-01')];
  const ids = groupByPerson(rows, o as never, false).map((e) => (e.kind === 'row' ? e.row.id : '?'));
  assert.deepEqual(ids, ['3', '1', '2']);
});
