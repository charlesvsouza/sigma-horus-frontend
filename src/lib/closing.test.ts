import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileMemberBalances, type ReceivableAccountInput, type MemberPaymentInput } from './closing.ts';

const to = new Date('2026-06-30');
const acc = (over: Partial<ReceivableAccountInput>): ReceivableAccountInput => ({
  memberId: 'm1', memberName: 'Ir∴ João', type: 'RECEIVABLE', amount: 100, dueDate: new Date('2026-06-10'), ...over,
});
const pay = (over: Partial<MemberPaymentInput>): MemberPaymentInput => ({
  memberId: 'm1', memberName: 'Ir∴ João', amount: 100, paidAt: new Date('2026-06-15'), accountType: 'RECEIVABLE', accountDueDate: new Date('2026-06-10'), ...over,
});

test('quita débito com pagamento no período → saldo zero', () => {
  const r = reconcileMemberBalances([acc({})], [pay({})], to);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { name: 'Ir∴ João', debito: 100, credito: 100, saldo: 0 });
});

test('pagamento antecipado (recebível vence depois de `to`) é ignorado dos dois lados', () => {
  // Cobrança vence em julho (depois de `to`), paga antecipadamente em junho.
  const future = new Date('2026-07-10');
  const r = reconcileMemberBalances(
    [acc({ dueDate: future })],
    [pay({ paidAt: new Date('2026-06-20'), accountDueDate: future })],
    to,
  );
  // Antes da correção: crédito 100 sem débito → saldo -100 (distorção). Agora: vazio.
  assert.equal(r.length, 0);
});

test('débito em aberto sem pagamento → saldo devedor positivo', () => {
  const r = reconcileMemberBalances([acc({ amount: 180 })], [], to);
  assert.deepEqual(r[0], { name: 'Ir∴ João', debito: 180, credito: 0, saldo: 180 });
});

test('despesa (PAYABLE) e pagamento sem membro não entram no saldo dos irmãos', () => {
  const r = reconcileMemberBalances(
    [acc({ type: 'PAYABLE' })],
    [pay({ memberId: null }), pay({ accountType: 'PAYABLE' })],
    to,
  );
  assert.equal(r.length, 0);
});

test('pagamento depois de `to` não conta', () => {
  const r = reconcileMemberBalances([acc({})], [pay({ paidAt: new Date('2026-07-05') })], to);
  assert.deepEqual(r[0], { name: 'Ir∴ João', debito: 100, credito: 0, saldo: 100 });
});

test('ordena por nome', () => {
  const r = reconcileMemberBalances(
    [acc({ memberId: 'b', memberName: 'Ir∴ Zacarias' }), acc({ memberId: 'a', memberName: 'Ir∴ Abel' })],
    [],
    to,
  );
  assert.deepEqual(r.map((x) => x.name), ['Ir∴ Abel', 'Ir∴ Zacarias']);
});
