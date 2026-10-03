import test from 'node:test';
import assert from 'node:assert/strict';
import { asaasCashNote, isAsaasCashStatus, pickCashAccount } from './asaas-cash.ts';

test('só RECEIVED_IN_CASH é recebimento em dinheiro', () => {
  assert.equal(isAsaasCashStatus('RECEIVED_IN_CASH'), true);
  for (const s of ['RECEIVED', 'CONFIRMED', 'PENDING', '', null, undefined]) assert.equal(isAsaasCashStatus(s), false);
});

test('caixa: prefere o padrão ativo; ignora conta bancária e caixa inativo', () => {
  const accs = [
    { id: 'b1', kind: 'bank', active: true, isDefault: true },
    { id: 'c1', kind: 'cash', active: true, isDefault: false },
    { id: 'c2', kind: 'cash', active: true, isDefault: true },
    { id: 'c3', kind: 'cash', active: false, isDefault: true },
  ];
  assert.equal(pickCashAccount(accs)?.id, 'c2');
  assert.equal(pickCashAccount(accs.filter((a) => a.id !== 'c2'))?.id, 'c1');
  assert.equal(pickCashAccount(accs.filter((a) => a.kind === 'bank')), null);
  assert.equal(pickCashAccount([]), null);
});

test('a nota cita o id do Asaas (a conferência de duplicidade procura por ele)', () => {
  assert.ok(asaasCashNote('pay_123').includes('pay_123'));
});
