import test from 'node:test';
import assert from 'node:assert/strict';
import { autoEmitWindow, decideAutoEmit, type AutoEmitCandidate } from './asaas-auto-emit-rules.ts';

const c = (over: Partial<AutoEmitCandidate>): AutoEmitCandidate => ({
  invoiceId: 'i', invoiceAmount: 110, memberCpf: '123.456.789-09', accountMemberId: 'm1',
  accountAmount: 110, accountStatus: 'pending', accountPaid: [], ...over,
});

test('janela: de hoje (Brasília) até +3 dias, em data-só-dia', () => {
  // 27/09 às 23h em Brasília = 28/09 02:00 UTC — ainda é dia 27 no calendário da loja.
  const w = autoEmitWindow(new Date('2026-09-28T02:00:00Z'));
  assert.equal(w.from.toISOString(), '2026-09-27T00:00:00.000Z');
  assert.equal(w.to.toISOString(), '2026-09-30T00:00:00.000Z');
});

test('emite o saldo da conta do membro (desconta parcial) — nunca acima da cobrança', () => {
  assert.deepEqual(decideAutoEmit(c({})), { emit: true, value: 110 });
  assert.deepEqual(decideAutoEmit(c({ accountPaid: [50] })), { emit: true, value: 60 });
  assert.deepEqual(decideAutoEmit(c({ accountAmount: 200, accountPaid: [] })), { emit: true, value: 110 });
});

test('conta compartilhada (cobrança em massa antiga): valor da própria cobrança', () => {
  assert.deepEqual(decideAutoEmit(c({ accountMemberId: null, accountAmount: 110, accountPaid: [110, 110] })), { emit: true, value: 110 });
});

test('não emite o que já está pago nem sem CPF', () => {
  assert.deepEqual(decideAutoEmit(c({ accountStatus: 'paid' })), { emit: false, reason: 'paid' });
  assert.deepEqual(decideAutoEmit(c({ accountPaid: [110] })), { emit: false, reason: 'paid' });
  assert.deepEqual(decideAutoEmit(c({ memberCpf: null })), { emit: false, reason: 'no-cpf' });
  assert.deepEqual(decideAutoEmit(c({ memberCpf: '  ' })), { emit: false, reason: 'no-cpf' });
});
