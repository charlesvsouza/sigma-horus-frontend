import test from 'node:test';
import assert from 'node:assert/strict';
import { decideBatchEmit, type BatchCandidate } from './asaas-batch-emit.ts';

const base: BatchCandidate = {
  invoiceId: 'i1', invoiceAmount: 220, memberCpf: '123.456.789-09', accountMemberId: 'm1', accountAmount: 220, accountStatus: 'pending', accountPaid: [],
  hasMember: true, inAgreement: false, cardPlan: false,
};

test('lote: cobrança em aberto com CPF é emitida pelo saldo (inclusive vencida: a data não é critério)', () => {
  assert.deepEqual(decideBatchEmit(base), { emit: true, value: 220 });
  assert.deepEqual(decideBatchEmit({ ...base, accountPaid: [100] }), { emit: true, value: 120 });
});

test('lote: fica de fora sem irmão, em acordo, cota de cartão, quitada ou sem CPF', () => {
  assert.deepEqual(decideBatchEmit({ ...base, hasMember: false }), { emit: false, reason: 'no-member' });
  assert.deepEqual(decideBatchEmit({ ...base, inAgreement: true }), { emit: false, reason: 'agreement' });
  assert.deepEqual(decideBatchEmit({ ...base, cardPlan: true }), { emit: false, reason: 'card' });
  assert.deepEqual(decideBatchEmit({ ...base, accountStatus: 'paid' }), { emit: false, reason: 'paid' });
  assert.deepEqual(decideBatchEmit({ ...base, accountPaid: [220] }), { emit: false, reason: 'paid' });
  assert.deepEqual(decideBatchEmit({ ...base, memberCpf: '  ' }), { emit: false, reason: 'no-cpf' });
});
