import assert from 'node:assert/strict';
import { test } from 'node:test';
import { approvalSummary, canApproveExpense, evaluateApprovals } from './expense-approval';

const v = { userId: 'v1', role: 'venerable' };
const t = { userId: 't1', role: 'treasurer' };
const a = { userId: 'a1', role: 'admin' };

test('sem nenhuma aprovação: falta o Venerável e o Tesoureiro', () => {
  const s = evaluateApprovals([], 'x');
  assert.equal(s.complete, false);
  assert.deepEqual(s.missing, ['Venerável', 'Tesoureiro']);
});

test('uma aprovação só não basta; Venerável + Tesoureiro completa', () => {
  assert.deepEqual(evaluateApprovals([v], 'x').missing, ['Tesoureiro']);
  assert.deepEqual(evaluateApprovals([t], 'x').missing, ['Venerável']);
  const s = evaluateApprovals([v, t], 'x');
  assert.equal(s.complete, true);
  assert.equal(s.viaValve, false);
});

test('quem lançou não conta como aprovador', () => {
  // o Tesoureiro lançou: a aprovação dele não vale, o lugar passa ao Administrador
  const s = evaluateApprovals([v, t], 't1', { launcherRole: 'treasurer' });
  assert.equal(s.complete, false);
  assert.deepEqual(s.missing, ['Administrador']);
  assert.equal(evaluateApprovals([v, a], 't1', { launcherRole: 'treasurer' }).complete, true, 'Venerável + Administrador');
});

test('Administrador ocupa um lugar; precisa de mais uma pessoa, a menos que use a válvula', () => {
  const alone = evaluateApprovals([a], 'x');
  assert.equal(alone.complete, false);
  assert.deepEqual(alone.missing, ['Venerável ou Tesoureiro']);
  assert.equal(evaluateApprovals([a, v], 'x').complete, true);
  assert.equal(evaluateApprovals([a, t], 'x').complete, true);
  const valve = evaluateApprovals([{ ...a, valve: true }], 'x');
  assert.equal(valve.complete, true);
  assert.equal(valve.viaValve, true);
});

test('válvula de quem lançou não vale', () => {
  assert.equal(evaluateApprovals([{ ...a, valve: true }], 'a1').complete, false);
});

test('papel que não aprova despesa é ignorado', () => {
  assert.equal(evaluateApprovals([{ userId: 's1', role: 'secretary' }, { userId: 'm1', role: 'member' }], 'x').complete, false);
});

test('quem pode aprovar agora', () => {
  assert.equal(canApproveExpense({ role: 'venerable', userId: 'v1' }, []).ok, true);
  assert.equal(canApproveExpense({ role: 'treasurer', userId: 't1' }, []).ok, true);
  const adm = canApproveExpense({ role: 'admin', userId: 'a1' }, []);
  assert.equal(adm.ok && adm.valve, true, 'só o Administrador tem a válvula');
  const ven = canApproveExpense({ role: 'venerable', userId: 'v1' }, []);
  assert.equal(ven.ok && ven.valve, false);
  assert.equal(canApproveExpense({ role: 'secretary', userId: 's1' }, []).ok, false);
  assert.equal(canApproveExpense({ role: 'treasurer', userId: 't1', launcherUserId: 't1' }, []).ok, false, 'lançou');
  assert.equal(canApproveExpense({ role: 'venerable', userId: 'v1' }, [v]).ok, false, 'já aprovou');
});

test('texto da lista de Contas', () => {
  const none = approvalSummary(evaluateApprovals([], 'x'), []);
  assert.match(none, /Falta: Venerável e Tesoureiro/);
  const part = approvalSummary(evaluateApprovals([v], 'x'), [{ name: 'Fulano', role: 'venerable' }]);
  assert.match(part, /Venerável: Fulano · Falta: Tesoureiro/);
  assert.equal(approvalSummary(evaluateApprovals([v, t], 'x'), []), 'Aprovada');
  assert.match(approvalSummary(evaluateApprovals([{ ...a, valve: true }], 'x'), []), /sozinho/);
});
