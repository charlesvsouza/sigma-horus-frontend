import test from 'node:test';
import assert from 'node:assert/strict';
import { canDecideRectification, checkDecision, compareBalances, isLockedDay, lockedMessage, parseCheckpointBalances, rectificationCovers } from './ledger-lock.ts';

const now = new Date('2026-10-07T12:00:00.000Z');
const base = { status: 'approved', dateFrom: '2026-09-01', dateTo: '2026-09-28', expiresAt: new Date('2026-10-08T12:00:00.000Z'), closedAt: null };

test('trava: dia até a data conferida é bloqueado, depois dela passa', () => {
  assert.equal(isLockedDay('2026-09-28', '2026-09-28'), true);
  assert.equal(isLockedDay('2026-09-10', '2026-09-28'), true);
  assert.equal(isLockedDay('2026-09-29', '2026-09-28'), false);
  assert.equal(isLockedDay('2026-01-01', null), false);
});

test('retificação libera só dentro da janela, aprovada, vigente e não encerrada', () => {
  assert.equal(rectificationCovers(base, '2026-09-10', now), true);
  assert.equal(rectificationCovers(base, '2026-08-31', now), false);
  assert.equal(rectificationCovers(base, '2026-09-29', now), false);
  assert.equal(rectificationCovers({ ...base, status: 'pending' }, '2026-09-10', now), false);
  assert.equal(rectificationCovers({ ...base, status: 'rejected' }, '2026-09-10', now), false);
  assert.equal(rectificationCovers({ ...base, expiresAt: new Date('2026-10-07T11:00:00.000Z') }, '2026-09-10', now), false);
  assert.equal(rectificationCovers({ ...base, closedAt: new Date('2026-10-07T10:00:00.000Z') }, '2026-09-10', now), false);
});

test('ciência: Tesoureiro não decide; solicitante não aprova a si mesmo, salvo se for o único', () => {
  assert.equal(canDecideRectification('treasurer'), false);
  assert.equal(canDecideRectification('secretary'), false);
  assert.equal(canDecideRectification('venerable'), true);
  assert.equal(canDecideRectification('admin'), true);
  assert.equal(checkDecision({ requesterId: 't', deciderId: 't', deciderRole: 'treasurer', eligibleApproverIds: ['v'] }).ok, false);
  assert.deepEqual(checkDecision({ requesterId: 't', deciderId: 'v', deciderRole: 'venerable', eligibleApproverIds: ['v', 'a'] }), { ok: true, selfApproved: false });
  assert.equal(checkDecision({ requesterId: 'v', deciderId: 'v', deciderRole: 'venerable', eligibleApproverIds: ['v', 'a'] }).ok, false);
  assert.deepEqual(checkDecision({ requesterId: 'a', deciderId: 'a', deciderRole: 'admin', eligibleApproverIds: ['a'] }), { ok: true, selfApproved: true });
});

test('conferência compara em centavos e informa a diferença', () => {
  const r = compareBalances([
    { accountId: 'a', name: 'CC', informed: 10.1, calculated: 10.1 },
    { accountId: 'b', name: 'Inv', informed: 100, calculated: 99.99 },
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].accountId, 'b');
  assert.equal(r[0].difference, 0.01);
});

test('mensagens e balanços', () => {
  assert.match(lockedMessage('2026-09-28'), /28\/09\/2026/);
  assert.deepEqual(parseCheckpointBalances('lixo'), []);
  assert.equal(parseCheckpointBalances('[{"accountId":"a","name":"x","informed":1,"calculated":1}]').length, 1);
});
