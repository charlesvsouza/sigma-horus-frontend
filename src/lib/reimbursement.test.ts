import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canCancel, canDecide, canRequestReimbursement, checkApprovedAmount, checkReimbursementInput, pendingForRole,
  reimbursementIdFromMarker, reimbursementMarker, submitTarget,
} from './reimbursement';

const today = new Date('2026-10-10T00:00:00Z');
const ok = { description: '2 barris de chope para o jantar ritualístico', vendorName: 'Distribuidora Alfa', amount: '780,00', expenseDate: '2026-10-09', chartAccountId: 'c1' };

test('pedido válido: valor com vírgula, descrição e data do gasto', () => {
  const r = checkReimbursementInput(ok, today);
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.value.amount, 780); assert.equal(r.value.vendorName, 'Distribuidora Alfa'); assert.equal(r.value.chartAccountId, 'c1'); }
});

test('pedido: recusa descrição vazia, valor inválido, data futura ou inexistente', () => {
  assert.equal(checkReimbursementInput({ ...ok, description: ' ' }, today).ok, false);
  assert.equal(checkReimbursementInput({ ...ok, amount: '0' }, today).ok, false);
  assert.equal(checkReimbursementInput({ ...ok, amount: '10,555' }, today).ok, false);
  assert.equal(checkReimbursementInput({ ...ok, expenseDate: '2026-10-11' }, today).ok, false);
  assert.equal(checkReimbursementInput({ ...ok, expenseDate: '2026-02-30' }, today).ok, false);
  const same = checkReimbursementInput({ ...ok, expenseDate: '2026-10-10' }, today);
  assert.equal(same.ok, true, 'o gasto de hoje vale');
});

test('categoria e estabelecimento são opcionais no pedido', () => {
  const r = checkReimbursementInput({ ...ok, chartAccountId: '', vendorName: '' }, today);
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.value.chartAccountId, null); assert.equal(r.value.vendorName, null); }
});

test('para onde o pedido vai ao ser enviado', () => {
  assert.deepEqual(submitTarget({ via: 'member', role: 'member', authorIsCreditor: true }), { status: 'submitted', implicit: false });
  assert.deepEqual(submitTarget({ via: 'staff', role: 'treasurer', authorIsCreditor: false }), { status: 'awaiting_vm', implicit: false });
  assert.deepEqual(submitTarget({ via: 'staff', role: 'venerable', authorIsCreditor: false }), { status: 'approved', implicit: true });
  assert.deepEqual(submitTarget({ via: 'staff', role: 'admin', authorIsCreditor: false }), { status: 'approved', implicit: true });
  // Venerável pedindo reembolso de gasto dele: nada de autorização implícita.
  assert.deepEqual(submitTarget({ via: 'staff', role: 'venerable', authorIsCreditor: true }), { status: 'awaiting_vm', implicit: false });
});

test('decisão: só Venerável/Administrador, nunca sobre o próprio pedido', () => {
  const r = { memberId: 'm1', requestedByUserId: 'u1' };
  assert.equal(canDecide({ role: 'venerable', userId: 'u9', memberId: 'm9' }, r).ok, true);
  assert.equal(canDecide({ role: 'admin', userId: 'u9', memberId: null }, r).ok, true);
  assert.equal(canDecide({ role: 'treasurer', userId: 'u9', memberId: 'm9' }, r).ok, false);
  assert.equal(canDecide({ role: 'venerable', userId: 'u5', memberId: 'm1' }, r).ok, false, 'é o beneficiário');
  assert.equal(canDecide({ role: 'venerable', userId: 'u1', memberId: 'm9' }, r).ok, false, 'digitou o pedido');
});

test('valor autorizado: igual à nota, ou menor com motivo; nunca maior', () => {
  assert.deepEqual(checkApprovedAmount(780, undefined, ''), { ok: true, value: 780 });
  assert.deepEqual(checkApprovedAmount(780, '780', ''), { ok: true, value: 780 });
  assert.equal(checkApprovedAmount(780, '700', '').ok, false);
  assert.deepEqual(checkApprovedAmount(780, '700,50', 'nota cobre só parte'), { ok: true, value: 700.5 });
  assert.equal(checkApprovedAmount(780, '800', 'x'.repeat(10)).ok, false);
  assert.equal(checkApprovedAmount(780, '-1', 'motivo').ok, false);
});

test('cancelar: o autor até a Tesouraria enviar; a Tesouraria até o Venerável decidir', () => {
  assert.equal(canCancel('draft', { isAuthor: true, isTreasury: false }), true);
  assert.equal(canCancel('returned', { isAuthor: true, isTreasury: false }), true);
  assert.equal(canCancel('submitted', { isAuthor: true, isTreasury: false }), true);
  assert.equal(canCancel('awaiting_vm', { isAuthor: true, isTreasury: false }), false);
  assert.equal(canCancel('awaiting_vm', { isAuthor: false, isTreasury: true }), true);
  for (const s of ['approved', 'paid', 'rejected', 'cancelled']) assert.equal(canCancel(s, { isAuthor: true, isTreasury: true }), false, s);
});

test('irmão ativo ou bloqueado pode pedir; candidato e inativo não', () => {
  assert.equal(canRequestReimbursement('active'), true);
  assert.equal(canRequestReimbursement('blocked'), true);
  for (const s of ['candidate', 'inactive', 'quit_placet', null, undefined]) assert.equal(canRequestReimbursement(s as string), false, String(s));
});

test('marca na conta a pagar: ida e volta', () => {
  assert.equal(reimbursementIdFromMarker(`Nota 123 ${reimbursementMarker('cabc_123')}`), 'cabc_123');
  assert.equal(reimbursementIdFromMarker('sem marca'), null);
  assert.equal(reimbursementIdFromMarker(null), null);
});

test('aviso do menu por papel', () => {
  const c = { submitted: 2, awaiting_vm: 3, approved: 1, paid: 9 };
  assert.equal(pendingForRole('treasurer', c), 3);
  assert.equal(pendingForRole('venerable', c), 3);
  assert.equal(pendingForRole('admin', c), 6);
  assert.equal(pendingForRole('member', c), 0);
});
