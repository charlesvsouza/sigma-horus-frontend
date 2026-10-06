import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCashClose } from './cash-close.ts';

test('fechamento: receita 1000 e despesa 300 já paga fecha em 700, não em 1000', () => {
  const t = computeCashClose({
    openingBalance: 0,
    accounts: [{ type: 'RECEIVABLE', amount: 1000 }, { type: 'PAYABLE', amount: 300 }],
    payments: [{ amount: 1000, accountType: 'RECEIVABLE' }, { amount: 300, accountType: 'PAYABLE' }],
  });
  assert.equal(t.netBalance, 700);
  assert.equal(t.closingBalance, 700);
  assert.equal(t.totalPayments, 1000);
  assert.equal(t.cashOut, 300);
});

test('fechamento: conta a pagar ainda não paga não reduz o caixa e a abertura é herdada', () => {
  const t = computeCashClose({
    openingBalance: 500,
    accounts: [{ type: 'PAYABLE', amount: 200 }],
    payments: [{ amount: 100.1, accountType: 'RECEIVABLE' }, { amount: 20.2, accountType: 'RECEIVABLE' }],
  });
  assert.equal(t.totalPayables, 200);
  assert.equal(t.netBalance, 120.3);
  assert.equal(t.closingBalance, 620.3);
});

test('fechamento: pagamento sem conta vinculada não entra nem como entrada nem como saída', () => {
  const t = computeCashClose({ openingBalance: 0, accounts: [], payments: [{ amount: 50, accountType: null }] });
  assert.equal(t.closingBalance, 0);
});
