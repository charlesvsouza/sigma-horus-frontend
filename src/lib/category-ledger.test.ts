import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCategoryLedger, NO_CATEGORY_KEY, type LedgerPaymentInput } from './category-ledger.ts';

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const tronco = { id: 'c-tronco', code: '1.1.05', name: 'Tronco de Beneficência', category: 'Receitas' };
const social = { id: 'c-social', code: '8.9.03', name: 'Ação Social e Caridade', category: 'Despesas' };
const mens = { id: 'c-mens', code: '1.1.01', name: 'Mensalidades', category: 'Receitas' };

const p = (over: Partial<LedgerPaymentInput> & { id: string; paidAt: Date; amount: number }): LedgerPaymentInput => ({
  accountType: 'RECEIVABLE', title: 'Lançamento', person: null, bank: 'Santander', method: 'manual', chart: tronco, ...over,
});

const payments: LedgerPaymentInput[] = [
  p({ id: 'a', paidAt: d('2026-08-10'), amount: 30.1 }),
  p({ id: 'b', paidAt: d('2026-08-20'), amount: 20.2 }),
  p({ id: 'c', paidAt: d('2026-09-02'), amount: 50, bank: 'Caixa da Loja' }),
  p({ id: 'd', paidAt: d('2026-09-05'), amount: 40, accountType: 'PAYABLE', chart: social, title: 'Cesta básica' }),
  p({ id: 'e', paidAt: d('2026-09-06'), amount: 15, accountType: 'PAYABLE', chart: tronco, title: 'Estorno' }),
  p({ id: 'f', paidAt: d('2026-09-10'), amount: 300, chart: mens }),
  p({ id: 'g', paidAt: d('2026-09-12'), amount: 10, chart: null, title: 'Sem categoria' }),
  p({ id: 'h', paidAt: d('2026-10-05'), amount: 999 }), // depois do período: ignorado
];

const from = d('2026-09-01');
const to = d('2026-09-30');

test('agrupa por categoria, ordena pelo código e deixa "sem categoria" por último', () => {
  const l = buildCategoryLedger(payments, from, to);
  assert.deepEqual(l.groups.map((g) => g.code), ['1.1.01', '1.1.05', '8.9.03', '—']);
  assert.equal(l.groups.at(-1)?.key, NO_CATEGORY_KEY);
});

test('saldo anterior soma o que veio antes do período, em centavos', () => {
  const l = buildCategoryLedger(payments, from, to);
  const t = l.groups.find((g) => g.key === 'c-tronco')!;
  assert.equal(t.opening, 50.3);
});

test('saldo acumulado por linha e fechamento da categoria', () => {
  const t = buildCategoryLedger(payments, from, to).groups.find((g) => g.key === 'c-tronco')!;
  assert.deepEqual(t.rows.map((r) => r.balance), [100.3, 85.3]);
  assert.equal(t.totalIn, 50);
  assert.equal(t.totalOut, 15);
  assert.equal(t.closing, 85.3);
});

test('o que vem depois do período não entra', () => {
  const t = buildCategoryLedger(payments, from, to).groups.find((g) => g.key === 'c-tronco')!;
  assert.equal(t.rows.some((r) => r.id === 'h'), false);
});

test('totais gerais somam as categorias', () => {
  const l = buildCategoryLedger(payments, from, to);
  assert.equal(l.totals.opening, 50.3);
  assert.equal(l.totals.in, 360);
  assert.equal(l.totals.out, 55);
  assert.equal(l.totals.closing, 355.3);
});

test('filtro de direção mostra só entradas ou só saídas, mantendo o saldo anterior', () => {
  const soEntradas = buildCategoryLedger(payments, from, to, 'in');
  assert.equal(soEntradas.totals.out, 0);
  assert.equal(soEntradas.groups.find((g) => g.key === 'c-tronco')!.rows.length, 1);
  const soSaidas = buildCategoryLedger(payments, from, to, 'out');
  assert.equal(soSaidas.totals.in, 0);
  assert.equal(soSaidas.groups.find((g) => g.key === 'c-tronco')!.opening, 50.3);
});

test('categoria sem movimento no período e sem saldo anterior não aparece', () => {
  const l = buildCategoryLedger([p({ id: 'z', paidAt: d('2026-01-10'), amount: 10, chart: social, accountType: 'PAYABLE' }), p({ id: 'y', paidAt: d('2026-09-02'), amount: 5 })], from, to);
  assert.deepEqual(l.groups.map((g) => g.key), ['c-tronco', 'c-social']); // social só pelo saldo anterior (−10)
  assert.equal(l.groups[1].opening, -10);
  const semSocial = buildCategoryLedger([p({ id: 'y', paidAt: d('2026-09-02'), amount: 5 })], from, to);
  assert.deepEqual(semSocial.groups.map((g) => g.key), ['c-tronco']);
});
