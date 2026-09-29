import test from 'node:test';
import assert from 'node:assert/strict';
import { accountDetail, buildAccountsReport, referenceLabel, type AccountReportRowInput } from './accounts-report.ts';

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

test('referência = mês/ano do vencimento (vence 05/10/2026 → outubro/2026)', () => {
  assert.equal(referenceLabel(new Date('2026-10-05T00:00:00Z')), 'outubro/2026');
  assert.equal(referenceLabel(new Date('2026-03-01T00:00:00Z')), 'março/2026');
  assert.equal(referenceLabel(null), null);
});

test('detalhe: some quando o título repete a categoria; fica quando diz algo a mais', () => {
  assert.equal(accountDetail('Mensalidades', 'Mensalidades'), null);
  assert.equal(accountDetail('Mensalidade', 'Mensalidades'), null);
  assert.equal(accountDetail('Mensalidade — Junho/2025', 'Mensalidades'), null);
  assert.equal(accountDetail('Ágape', 'Ágapes'), null);
  assert.equal(accountDetail('Ágape da iniciação', 'Ágapes'), 'Ágape da iniciação');
  assert.equal(accountDetail('Mensalidades - maio/2026', 'Mensalidades'), null);
  assert.equal(accountDetail('Venda de ritual de Aprendiz', 'Venda de materiais'), 'Venda de ritual de Aprendiz');
  assert.equal(accountDetail('Doação avulsa', null), 'Doação avulsa');
});

test('linha liquidada: referência pelo vencimento da conta, não pela data do pagamento', () => {
  const r = buildAccountsReport(
    [{ id: 'p1', date: new Date('2026-07-10'), personId: 'm1', personName: 'Ana', description: 'Mensalidades', category: 'Mensalidades', amount: 220, dueDate: new Date('2026-05-05T00:00:00Z') }],
    { from: new Date('2026-07-01'), to: new Date('2026-07-31') },
  );
  assert.equal(r.rows[0].reference, 'maio/2026');
  assert.equal(r.rows[0].detail, null);
  assert.equal(buildAccountsReport(r.rows.length ? [{ id: 'p1', date: new Date('2026-07-10'), personId: null, personName: null, description: 'Mensalidades', category: 'Mensalidades', amount: 1, dueDate: new Date('2026-05-05T00:00:00Z') }] : [], { from: new Date('2026-07-01'), to: new Date('2026-07-31'), text: 'maio' }).rows.length, 1);
});

test('ordena pelo mês de referência, depois nome, depois data (não pela data do pagamento)', () => {
  const d = (s: string) => new Date(s);
  const r = buildAccountsReport([
    { id: 'jun-bruno', date: d('2026-06-10'), personId: 'm2', personName: 'Bruno', description: 'Mensalidades', category: 'Mensalidades', amount: 1, dueDate: d('2026-06-05T00:00:00Z') },
    { id: 'mai-carlos', date: d('2026-07-02'), personId: 'm3', personName: 'Carlos', description: 'Mensalidades', category: 'Mensalidades', amount: 1, dueDate: d('2026-05-05T00:00:00Z') },
    { id: 'jun-ana', date: d('2026-06-20'), personId: 'm1', personName: 'Ana', description: 'Mensalidades', category: 'Mensalidades', amount: 1, dueDate: d('2026-06-05T00:00:00Z') },
    { id: 'mai-alvaro', date: d('2026-05-06'), personId: 'm4', personName: 'Álvaro', description: 'Mensalidades', category: 'Mensalidades', amount: 1, dueDate: d('2026-05-05T00:00:00Z') },
  ], { from: d('2026-01-01'), to: d('2026-12-31') });
  assert.deepEqual(r.rows.map((x) => x.id), ['mai-alvaro', 'mai-carlos', 'jun-ana', 'jun-bruno']);
});
