import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectedCashFlow } from './cashflow.ts';
import { getLodgeOverdueDuesReport } from './overdue.ts';

// Pagamento parcial: o que já foi pago de uma conta não pode voltar a aparecer como "em aberto".

const NOW = new Date('2026-10-06T12:00:00.000Z');
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

test('fluxo de caixa projetado desconta o pago de conta parcial e ignora a quitada', async () => {
  const db = {
    account: {
      findMany: async () => [
        { type: 'RECEIVABLE', amount: 100, dueDate: day('2026-09-01'), payments: [{ amount: 40 }] },
        { type: 'RECEIVABLE', amount: 50, dueDate: day('2026-09-02'), payments: [{ amount: 50 }] },
        { type: 'PAYABLE', amount: 30, dueDate: day('2026-10-20'), payments: [] },
      ],
    },
    cashClose: { findFirst: async () => null },
  };
  const flow = await getProjectedCashFlow(db as never, 'l1', NOW);
  assert.equal(flow.buckets[0].receivable, 60);
  assert.equal(flow.buckets[1].payable, 30);
  assert.equal(flow.buckets.reduce((s, b) => s + b.receivable, 0), 60);
});

test('inadimplência usa o saldo restante e tira quem quitou por completo', async () => {
  const db = {
    account: {
      findMany: async () => [
        { memberId: 'm1', amount: 110, dueDate: day('2026-08-05'), payments: [{ amount: 60 }] },
        { memberId: 'm2', amount: 110, dueDate: day('2026-08-05'), payments: [{ amount: 110 }] },
      ],
    },
    invoice: {
      findMany: async () => [
        { memberId: 'm3', amount: 110, dueDate: day('2026-08-05'), account: { amount: 110, status: 'pending', payments: [{ amount: 10 }] } },
      ],
    },
    member: { findMany: async () => [{ id: 'm1', name: 'A', status: 'active' }, { id: 'm2', name: 'B', status: 'active' }, { id: 'm3', name: 'C', status: 'active' }] },
    lodge: { findUnique: async () => ({ lateFeePercent: null, lateInterestPercentMonth: null }) },
  };
  const rows = await getLodgeOverdueDuesReport(db as never, 'l1', NOW);
  assert.deepEqual(rows.map((r) => [r.memberId, r.totalAmount]).sort(), [['m1', 50], ['m3', 100]]);
});
