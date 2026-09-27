import test from 'node:test';
import assert from 'node:assert/strict';
import { canPay, effectiveStatus, openBalance } from './portal-dues.ts';

// 27/09/2026 10:00 em Brasília.
const NOW = new Date('2026-09-27T13:00:00Z');

test('status efetivo: vence hoje está em dia; vencido só no dia seguinte', () => {
  assert.equal(effectiveStatus({ status: 'pending', dueDate: '2026-09-27' }, NOW), 'pending');
  assert.equal(effectiveStatus({ status: 'pending', dueDate: '2026-09-26' }, NOW), 'overdue');
  assert.equal(effectiveStatus({ status: 'pending', dueDate: '2026-10-10' }, NOW), 'pending');
  assert.equal(effectiveStatus({ status: 'paid', dueDate: '2026-01-01' }, NOW), 'paid');
});

test('saldo em aberto desconta pagamentos parciais, em centavos', () => {
  assert.equal(openBalance({ amount: 30.3, status: 'pending' }, [{ amount: 10.1 }, { amount: 10.1 }]), 10.1);
  assert.equal(openBalance({ amount: 110, status: 'pending' }, []), 110);
  assert.equal(openBalance({ amount: 110, status: 'pending' }, [{ amount: 120 }]), 0);
  assert.equal(openBalance({ amount: 110, status: 'paid' }, []), 0);
});

test('só paga pelo portal a conta a receber, do próprio irmão, aprovada e em aberto', () => {
  const base = { type: 'RECEIVABLE', status: 'pending', amount: 110, dueDate: '2026-09-01', memberId: 'm1', approvalStatus: 'approved' };
  assert.equal(canPay(base, 'm1', 110), true);
  assert.equal(canPay(base, 'm2', 110), false);
  assert.equal(canPay({ ...base, type: 'PAYABLE' }, 'm1', 110), false);
  assert.equal(canPay({ ...base, status: 'paid' }, 'm1', 110), false);
  assert.equal(canPay({ ...base, approvalStatus: 'pending' }, 'm1', 110), false);
  assert.equal(canPay(base, 'm1', 0), false);
});
