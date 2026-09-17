import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPaymentsByChartAccount, compareDre, type DrePaymentInput } from './dre.ts';

const pay = (over: Partial<DrePaymentInput>): DrePaymentInput => ({
  amount: 100, paidAt: new Date('2026-06-15'), accountType: 'RECEIVABLE',
  chartAccount: { code: '1.1.01', name: 'Mensalidades', category: 'Receitas' }, ...over,
});

test('groupPaymentsByChartAccount: soma por código, ignora fora do período', () => {
  const rows = groupPaymentsByChartAccount(
    [
      pay({ amount: 100, paidAt: new Date('2026-06-05') }),
      pay({ amount: 50, paidAt: new Date('2026-06-20') }),
      pay({ amount: 999, paidAt: new Date('2026-07-01') }), // fora do período
    ],
    new Date('2026-06-01'),
    new Date('2026-06-30'),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, 150);
});

test('groupPaymentsByChartAccount: sem chartAccount cai em "Sem classificação"', () => {
  const rows = groupPaymentsByChartAccount(
    [pay({ chartAccount: null, accountTitle: 'Doação avulsa' })],
    new Date('2026-06-01'),
    new Date('2026-06-30'),
  );
  assert.equal(rows[0].name, 'Doação avulsa');
  assert.equal(rows[0].code, '1.0.00');
});

test('compareDre: conta que só existe no período A', () => {
  const a = groupPaymentsByChartAccount([pay({ amount: 200 })], new Date('2026-06-01'), new Date('2026-06-30'));
  const cmp = compareDre(a, []);
  assert.equal(cmp.rows.length, 1);
  assert.equal(cmp.rows[0].valueA, 200);
  assert.equal(cmp.rows[0].valueB, 0);
  assert.equal(cmp.rows[0].variance, 200);
  assert.equal(cmp.rows[0].variancePct, null); // B=0, % não expressável
});

test('compareDre: conta que só existe no período B', () => {
  const b = groupPaymentsByChartAccount([pay({ amount: 300 })], new Date('2026-06-01'), new Date('2026-06-30'));
  const cmp = compareDre([], b);
  assert.equal(cmp.rows[0].valueA, 0);
  assert.equal(cmp.rows[0].valueB, 300);
  assert.equal(cmp.rows[0].variance, -300);
});

test('compareDre: variação percentual e totais de receita/despesa/saldo', () => {
  const a = groupPaymentsByChartAccount(
    [
      pay({ amount: 200, chartAccount: { code: '1.1.01', name: 'Mensalidades', category: 'Receitas' } }),
      pay({ amount: 50, accountType: 'PAYABLE', chartAccount: { code: '2.1.01', name: 'Aluguel', category: 'Despesas' } }),
    ],
    new Date('2026-06-01'),
    new Date('2026-06-30'),
  );
  const b = groupPaymentsByChartAccount(
    [
      pay({ amount: 100, paidAt: new Date('2026-05-15'), chartAccount: { code: '1.1.01', name: 'Mensalidades', category: 'Receitas' } }),
      pay({ amount: 50, paidAt: new Date('2026-05-15'), accountType: 'PAYABLE', chartAccount: { code: '2.1.01', name: 'Aluguel', category: 'Despesas' } }),
    ],
    new Date('2026-05-01'),
    new Date('2026-05-31'),
  );
  const cmp = compareDre(a, b);
  const mensalidades = cmp.rows.find((r) => r.code === '1.1.01')!;
  assert.equal(mensalidades.variancePct, 100); // dobrou
  assert.equal(cmp.totals.revenueA, 200);
  assert.equal(cmp.totals.revenueB, 100);
  assert.equal(cmp.totals.expenseA, 50);
  assert.equal(cmp.totals.netA, 150);
  assert.equal(cmp.totals.netB, 50);
});
