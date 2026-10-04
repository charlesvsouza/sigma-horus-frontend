import test from 'node:test';
import assert from 'node:assert/strict';
import { countAccountsByDue, countInvoicesByDue } from './dashboard-counts.ts';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const TODAY = d('2026-10-05');

test('contas: status gravado "pending" com vencimento passado conta como vencida (o bug da Visão geral)', () => {
  const accounts = [
    { id: 'a', amount: 140, dueDate: d('2026-09-05'), status: 'pending' },   // vencida, ainda "pending" no banco
    { id: 'b', amount: 140, dueDate: d('2026-10-05'), status: 'pending' },   // vence hoje: ainda em dia
    { id: 'c', amount: 140, dueDate: d('2026-11-05'), status: 'pending' },   // a vencer
    { id: 'd', amount: 140, dueDate: d('2026-08-05'), status: 'paid' },      // paga
    { id: 'e', amount: 100, dueDate: d('2026-09-01'), status: 'pending' },   // quitada por pagamentos
    { id: 'f', amount: 100, dueDate: d('2026-09-01'), status: 'pending', approvalStatus: 'rejected' },
    { id: 'g', amount: 100, dueDate: d('2026-09-01'), status: 'overdue' },   // marcada à mão como vencida
    { id: 'h', amount: 200, dueDate: d('2026-09-10'), status: 'pending' },   // paga em parte: ainda deve 50
  ];
  const paid = new Map([['e', 100], ['h', 150]]);
  assert.deepEqual(countAccountsByDue(accounts, paid, TODAY), { overdue: 3, pending: 2 });
});

test('contas: lista vazia e conta paga em parte antes do vencimento', () => {
  assert.deepEqual(countAccountsByDue([], new Map(), TODAY), { overdue: 0, pending: 0 });
  assert.deepEqual(countAccountsByDue([{ id: 'x', amount: 100, dueDate: d('2026-12-01'), status: 'pending' }], new Map([['x', 30]]), TODAY), { overdue: 0, pending: 1 });
});

test('cobranças: vencida = não fechada e vencimento antes de hoje', () => {
  const inv = [
    { status: 'pending', dueDate: d('2026-09-30') },
    { status: 'overdue', dueDate: d('2026-09-01') },
    { status: 'pending', dueDate: d('2026-10-05') },
    { status: 'pending', dueDate: d('2026-11-01') },
    { status: 'paid', dueDate: d('2026-09-01') },
    { status: 'cancelled', dueDate: d('2026-09-01') },
  ];
  assert.deepEqual(countInvoicesByDue(inv, TODAY), { overdue: 2, pending: 2 });
});
