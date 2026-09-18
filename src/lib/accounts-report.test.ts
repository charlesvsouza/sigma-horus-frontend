import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountsReport, type AccountReportRowInput } from './accounts-report.ts';

const rows: AccountReportRowInput[] = [
  { id: 'a1', date: new Date('2026-06-05'), personId: 'm1', personName: 'Ana', description: 'Mensalidade', category: 'Receitas', amount: 100 },
  { id: 'a2', date: new Date('2026-06-15'), personId: 'm2', personName: 'Bruno', description: 'Doação', category: 'Tronco', amount: 50 },
  { id: 'a3', date: new Date('2026-07-01'), personId: 'm1', personName: 'Ana', description: 'Mensalidade', category: 'Receitas', amount: 100 },
];

test('filtra por período (from/to)', () => {
  const r = buildAccountsReport(rows, { from: new Date('2026-06-01'), to: new Date('2026-06-30') });
  assert.equal(r.rows.length, 2);
  assert.equal(r.total, 150);
});

test('filtra por pessoa', () => {
  const r = buildAccountsReport(rows, { from: new Date('2026-01-01'), to: new Date('2026-12-31'), personId: 'm1' });
  assert.equal(r.rows.length, 2);
  assert.ok(r.rows.every((row) => row.personId === 'm1'));
});

test('filtra por texto (descrição ou categoria)', () => {
  const r = buildAccountsReport(rows, { from: new Date('2026-01-01'), to: new Date('2026-12-31'), text: 'tronco' });
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].id, 'a2');
});

test('filtra por faixa de valor', () => {
  const r = buildAccountsReport(rows, { from: new Date('2026-01-01'), to: new Date('2026-12-31'), amountMin: 60 });
  assert.equal(r.rows.length, 2);
  assert.ok(r.rows.every((row) => row.amount >= 60));
});

test('ordena por data crescente', () => {
  const r = buildAccountsReport(rows, { from: new Date('2026-01-01'), to: new Date('2026-12-31') });
  assert.deepEqual(r.rows.map((row) => row.id), ['a1', 'a2', 'a3']);
});
