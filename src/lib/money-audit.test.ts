import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { examplesSql, parseFloatColumns, summarySql, verdict, type ColumnReport } from './money-audit.ts';

const schema = readFileSync('prisma/schema.prisma', 'utf-8');

test('acha os campos Float do schema real, separando taxas de dinheiro', () => {
  const cols = parseFloatColumns(schema);
  const has = (model: string, field: string) => cols.find((c) => c.model === model && c.field === field);
  assert.equal(has('Payment', 'amount')?.kind, 'money');
  assert.equal(has('Invoice', 'asaasFee')?.kind, 'money');
  assert.equal(has('Lodge', 'lateFeePercent')?.kind, 'percent');
  assert.equal(has('Lodge', 'lateInterestPercentMonth')?.kind, 'percent');
  // Todo Float do schema é coberto (se alguém criar um campo novo, ele entra na auditoria sozinho).
  const declared = (schema.match(/^\s+\w+\s+Float\??(\s|$)/gm) ?? []).length;
  assert.equal(cols.length, declared);
});

test('ignora campos que não são Float e blocos que não são model', () => {
  const cols = parseFloatColumns(`
model A {
  id     String @id
  price  Float
  qty    Int
  note   String? // Float no comentário
}
enum E {
  Float
}
model B {
  cost   Float?
}`);
  assert.deepEqual(cols.map((c) => `${c.model}.${c.field}`), ['A.price', 'B.cost']);
});

test('as consultas só usam identificadores seguros', () => {
  assert.throws(() => summarySql({ model: 'Payment"; DROP TABLE x; --', field: 'amount', kind: 'money' }));
  assert.throws(() => examplesSql({ model: 'Payment', field: 'amount"', kind: 'money' }));
  assert.match(summarySql({ model: 'Payment', field: 'amount', kind: 'money' }), /FROM "Payment"/);
});

const report = (over: Partial<ColumnReport>): ColumnReport => ({
  model: 'Payment', field: 'amount', kind: 'money', total: 10, filled: 10,
  subCent: 0, negative: 0, nonFinite: 0, tooBig: 0, maxAbs: '100', examples: [], ...over,
});

test('veredito: limpo quando só há taxas com casas; sujo quando dinheiro tem mais de 2 casas', () => {
  assert.equal(verdict([report({}), report({ kind: 'percent', field: 'lateFeePercent', subCent: 3 })]).clean, true);
  const dirty = verdict([report({ subCent: 2 }), report({ model: 'Account', tooBig: 1 })]);
  assert.equal(dirty.clean, false);
  assert.equal(dirty.dirty.length, 2);
  assert.equal(dirty.subCentTotal, 2);
});

test('veredito lista colunas de dinheiro com negativos (aviso, não sujeira)', () => {
  const v = verdict([report({ negative: 4 })]);
  assert.equal(v.clean, true);
  assert.deepEqual(v.negativeColumns, ['Payment.amount']);
});
