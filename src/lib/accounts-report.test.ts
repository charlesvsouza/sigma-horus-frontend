import test from 'node:test';
import assert from 'node:assert/strict';
import { accountDetail, buildAccountsReport, parseAccountsSort, referenceLabel, type AccountReportRowInput } from './accounts-report.ts';

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

test('parseAccountsSort: valores desconhecidos caem na Referência', () => {
  assert.equal(parseAccountsSort('nome'), 'nome');
  assert.equal(parseAccountsSort('data'), 'data');
  assert.equal(parseAccountsSort(undefined), 'referencia');
  assert.equal(parseAccountsSort('xyz'), 'referencia');
});

const sortRows: AccountReportRowInput[] = [
  { id: 'out-bruno-05', date: new Date('2026-10-05T00:00:00Z'), personId: 'm2', personName: 'Bruno', description: 'Mensalidades', category: 'Mensalidades', amount: 10, dueDate: new Date('2026-10-05T00:00:00Z') },
  { id: 'out-antonio-10', date: new Date('2026-10-10T00:00:00Z'), personId: 'm1', personName: 'Antônio', description: 'Mensalidades', category: 'Mensalidades', amount: 20, dueDate: new Date('2026-10-10T00:00:00Z') },
  { id: 'set-bruno-20', date: new Date('2026-09-20T00:00:00Z'), personId: 'm2', personName: 'Bruno', description: 'Mensalidades', category: 'Mensalidades', amount: 30, dueDate: new Date('2026-09-20T00:00:00Z') },
  { id: 'out-semnome-01', date: new Date('2026-10-01T00:00:00Z'), personId: null, personName: null, description: 'Aluguel', category: 'Despesas', amount: 40, dueDate: new Date('2026-10-01T00:00:00Z') },
];
const year = { from: new Date('2026-01-01'), to: new Date('2026-12-31') };

test('ordem Referência (padrão): mês, depois nome; subtotal por mês', () => {
  const r = buildAccountsReport(sortRows, year);
  assert.deepEqual(r.rows.map((x) => x.id), ['set-bruno-20', 'out-antonio-10', 'out-bruno-05', 'out-semnome-01']);
  assert.deepEqual(r.groups?.map((g) => [g.label, g.rows.length, g.total]), [['setembro/2026', 1, 30], ['outubro/2026', 3, 70]]);
});

test('ordem Data: dia a dia, sem subtotais', () => {
  const r = buildAccountsReport(sortRows, { ...year, sort: 'data' });
  assert.deepEqual(r.rows.map((x) => x.id), ['set-bruno-20', 'out-semnome-01', 'out-bruno-05', 'out-antonio-10']);
  assert.equal(r.groups, null);
});

test('ordem Nome: pessoa a pessoa (sem nome no fim), mês a mês; subtotal por pessoa', () => {
  const r = buildAccountsReport(sortRows, { ...year, sort: 'nome' });
  assert.deepEqual(r.rows.map((x) => x.id), ['out-antonio-10', 'set-bruno-20', 'out-bruno-05', 'out-semnome-01']);
  assert.deepEqual(r.groups?.map((g) => [g.label, g.total]), [['Antônio', 20], ['Bruno', 40], ['Sem nome', 40]]);
  assert.equal(r.groups?.reduce((s, g) => s + g.total, 0), r.total);
});

test('ordem Referência: pagamento sem vencimento vai pro fim, num bloco só', () => {
  const r = buildAccountsReport([
    { id: 'sem-1', date: new Date('2026-03-01'), personId: null, personName: 'X', description: 'Pagamento', category: null, amount: 1 },
    { id: 'out', date: new Date('2026-10-01'), personId: null, personName: 'Y', description: 'Pagamento', category: null, amount: 1, dueDate: new Date('2026-10-01T00:00:00Z') },
    { id: 'sem-2', date: new Date('2026-12-01'), personId: null, personName: 'Z', description: 'Pagamento', category: null, amount: 1 },
  ], year);
  assert.deepEqual(r.groups?.map((g) => g.label), ['outubro/2026', 'Sem referência']);
});

test('ordem Nenhuma: volta ao modo de antes — ordem da Referência, sem blocos', () => {
  const ref = buildAccountsReport(sortRows, year);
  const nenhuma = buildAccountsReport(sortRows, { ...year, sort: 'nenhuma' });
  assert.deepEqual(nenhuma.rows.map((x) => x.id), ref.rows.map((x) => x.id));
  assert.equal(nenhuma.groups, null);
  assert.equal(parseAccountsSort('nenhuma'), 'nenhuma');
});

test('subtotais desligados: mesma ordem, sem blocos', () => {
  const com = buildAccountsReport(sortRows, { ...year, sort: 'nome' });
  const sem = buildAccountsReport(sortRows, { ...year, sort: 'nome', subtotals: false });
  assert.deepEqual(sem.rows.map((x) => x.id), com.rows.map((x) => x.id));
  assert.equal(sem.groups, null);
  assert.equal(sem.total, com.total);
});
