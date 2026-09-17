import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFinancialAccountBalances, computeAccountStatement, type StatementMovementInput } from './financial-accounts.ts';

test('computeFinancialAccountBalances: abertura + pagamentos + transferências aprovadas', () => {
  const r = computeFinancialAccountBalances(
    [{ id: 'a', openingBalance: 100 }, { id: 'b', openingBalance: 0 }],
    [
      { bankAccountId: 'a', amount: 50, accountType: 'RECEIVABLE' },
      { bankAccountId: 'a', amount: 20, accountType: 'PAYABLE' },
      { bankAccountId: null, amount: 999, accountType: 'RECEIVABLE' }, // sem conta vinculada — ignorado
    ],
    [{ fromId: 'a', toId: 'b', amount: 30 }],
  );
  assert.deepEqual(r, [
    { id: 'a', saldo: 100 + 50 - 20 - 30 },
    { id: 'b', saldo: 0 + 30 },
  ]);
});

test('computeFinancialAccountBalances: transferência pendente/rejeitada não entra (filtro é responsabilidade do chamador)', () => {
  // A função só recebe o que já foi filtrado por status='approved' — aqui simulamos
  // o chamador já tendo excluído a pendente, então ela nunca chega na função.
  const r = computeFinancialAccountBalances([{ id: 'a', openingBalance: 10 }], [], []);
  assert.deepEqual(r, [{ id: 'a', saldo: 10 }]);
});

const mv = (over: Partial<StatementMovementInput>): StatementMovementInput => ({
  date: new Date('2026-06-15'), kind: 'payment_in', description: 'Mensalidade', reference: 'Ir∴ João', amount: 100, ...over,
});

test('computeAccountStatement: movimentação antes do período entra só na abertura', () => {
  const s = computeAccountStatement(
    500,
    [mv({ date: new Date('2026-05-01'), amount: 200, kind: 'payment_in' })],
    new Date('2026-06-01'),
    new Date('2026-06-30'),
  );
  assert.equal(s.openingBalance, 700);
  assert.equal(s.movements.length, 0);
  assert.equal(s.closingBalance, 700);
});

test('computeAccountStatement: movimentação depois de `to` é ignorada', () => {
  const s = computeAccountStatement(
    500,
    [mv({ date: new Date('2026-07-10'), amount: 200, kind: 'payment_in' })],
    new Date('2026-06-01'),
    new Date('2026-06-30'),
  );
  assert.equal(s.openingBalance, 500);
  assert.equal(s.movements.length, 0);
  assert.equal(s.closingBalance, 500);
});

test('computeAccountStatement: saldo corrente por linha, na ordem cronológica, saldo final = última linha', () => {
  const s = computeAccountStatement(
    1000,
    [
      mv({ date: new Date('2026-06-20'), kind: 'payment_out', amount: 300, description: 'Aluguel' }),
      mv({ date: new Date('2026-06-05'), kind: 'payment_in', amount: 150, description: 'Mensalidade' }),
      mv({ date: new Date('2026-06-12'), kind: 'transfer_in', amount: 400, description: 'Transferência de Caixa' }),
    ],
    new Date('2026-06-01'),
    new Date('2026-06-30'),
  );
  assert.equal(s.movements.length, 3);
  assert.deepEqual(s.movements.map((m) => m.description), ['Mensalidade', 'Transferência de Caixa', 'Aluguel']);
  assert.deepEqual(s.movements.map((m) => m.balance), [1150, 1550, 1250]);
  assert.equal(s.closingBalance, 1250);
  assert.equal(s.totalIn, 550);
  assert.equal(s.totalOut, 300);
});

test('computeAccountStatement: transferência de saída usa sinal negativo', () => {
  const s = computeAccountStatement(
    100,
    [mv({ date: new Date('2026-06-10'), kind: 'transfer_out', amount: 40, description: 'Transferência para Banco' })],
    new Date('2026-06-01'),
    new Date('2026-06-30'),
  );
  assert.equal(s.movements[0].signedAmount, -40);
  assert.equal(s.closingBalance, 60);
});
