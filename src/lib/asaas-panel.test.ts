import test from 'node:test';
import assert from 'node:assert/strict';
import { asaasSituation, summarizeAsaasRows } from '@/lib/asaas-panel';

const today = new Date('2026-10-28T00:00:00Z');

test('situação: paga, cancelada, vencida (só depois do dia) e aguardando', () => {
  assert.equal(asaasSituation('paid', new Date('2026-09-01T00:00:00Z'), today), 'settled');
  assert.equal(asaasSituation('cancelled', new Date('2026-12-01T00:00:00Z'), today), 'cancelled');
  assert.equal(asaasSituation('billed', new Date('2026-10-27T00:00:00Z'), today), 'overdue');
  assert.equal(asaasSituation('billed', new Date('2026-10-28T00:00:00Z'), today), 'waiting');
  assert.equal(asaasSituation('pending', new Date('2026-11-05T00:00:00Z'), today), 'waiting');
});

test('resumo: soma por situação, tarifa e líquido só das baixadas', () => {
  const s = summarizeAsaasRows([
    { situation: 'settled', amount: 110, fee: 1.99 },
    { situation: 'settled', amount: 5, fee: null },
    { situation: 'waiting', amount: 220, fee: null },
    { situation: 'overdue', amount: 5, fee: null },
    { situation: 'cancelled', amount: 50, fee: null },
  ]);
  assert.equal(s.count, 5);
  assert.deepEqual(s.settled, { count: 2, total: 115, fees: 1.99, net: 113.01 });
  assert.deepEqual(s.waiting, { count: 1, total: 220 });
  assert.deepEqual(s.overdue, { count: 1, total: 5 });
  assert.equal(s.cancelled.count, 1);
  assert.equal(s.unknownFee, 1);
});
