import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentHistory, canSeePaymentHistory, defaultPeriod, paymentMethodLabel, periodBounds, type PaymentHistoryInput } from './payment-history.ts';

const row = (over: Partial<PaymentHistoryInput>): PaymentHistoryInput => ({
  id: 'p', paidAt: new Date('2026-03-10T15:00:00Z'), memberId: 'm1', memberName: 'Ana', title: 'Mensalidades',
  category: 'Mensalidades', dueDate: new Date('2026-03-05T00:00:00Z'), method: 'pix', amount: 110, ...over,
});

test('só Tesoureiro, Administrador e Venerável veem o histórico de todos (Secretário não)', () => {
  assert.equal(canSeePaymentHistory('admin'), true);
  assert.equal(canSeePaymentHistory('treasurer'), true);
  assert.equal(canSeePaymentHistory('venerable'), true);
  assert.equal(canSeePaymentHistory('secretary'), false);
  assert.equal(canSeePaymentHistory('member'), false);
  assert.equal(canSeePaymentHistory(undefined), false);
});

test('período no calendário de Brasília: o dia "até" vai até 23:59 BR', () => {
  const b = periodBounds('2026-03-01', '2026-03-31');
  assert.equal(b.from?.toISOString(), '2026-03-01T03:00:00.000Z');
  assert.equal(b.to?.toISOString(), '2026-04-01T02:59:59.999Z');
  assert.deepEqual(periodBounds('', 'lixo'), { from: null, to: null });
  // 31/12 às 22h em Brasília ainda é 31/12 (já é 01/01 em UTC).
  assert.deepEqual(defaultPeriod(new Date('2027-01-01T01:00:00Z')), { from: '2026-01-01', to: '2026-12-31' });
});

test('filtra por período e irmão, ordena por data e totaliza em centavos', () => {
  const rows = [
    row({ id: 'b', paidAt: new Date('2026-04-02T12:00:00Z'), amount: 10.1 }),
    row({ id: 'a', paidAt: new Date('2026-03-10T12:00:00Z'), amount: 20.2 }),
    row({ id: 'c', memberId: 'm2', memberName: 'Bruno', amount: 30 }),
    row({ id: 'fora', paidAt: new Date('2025-12-31T12:00:00Z') }),
  ];
  const { from, to } = periodBounds('2026-01-01', '2026-12-31');
  const all = buildPaymentHistory(rows, { from, to });
  assert.deepEqual(all.rows.map((r) => r.id), ['a', 'c', 'b']);
  assert.equal(all.total, 60.3);
  assert.deepEqual(all.byMember, [
    { memberId: 'm1', memberName: 'Ana', count: 2, total: 30.3 },
    { memberId: 'm2', memberName: 'Bruno', count: 1, total: 30 },
  ]);
  const ana = buildPaymentHistory(rows, { from, to, memberId: 'm1' });
  assert.deepEqual(ana.rows.map((r) => r.id), ['a', 'b']);
  assert.equal(ana.total, 30.3);
});

test('rótulo da forma de pagamento', () => {
  assert.equal(paymentMethodLabel('pix'), 'Pix');
  assert.equal(paymentMethodLabel('cash'), 'Dinheiro');
  assert.equal(paymentMethodLabel('asaas'), 'Asaas');
  assert.equal(paymentMethodLabel('outro'), 'outro');
  assert.equal(paymentMethodLabel(null), '—');
});
