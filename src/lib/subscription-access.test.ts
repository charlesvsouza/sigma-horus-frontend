import test from 'node:test';
import assert from 'node:assert/strict';
import { pastDueGrace, subscriptionAccess } from './subscription-access.ts';
import { enforcementMode, requireActiveSubscription } from './subscription-guard.ts';

const NOW = Date.parse('2026-09-20T12:00:00Z');
const day = 24 * 60 * 60 * 1000;

test('active libera', () => {
  assert.deepEqual(subscriptionAccess({ status: 'active', trialEndsAt: null }, NOW), { blocked: false, reason: null });
});

test('trialing com prazo por vir libera; vencido bloqueia como trial_expired', () => {
  assert.equal(subscriptionAccess({ status: 'trialing', trialEndsAt: new Date(NOW + day) }, NOW).blocked, false);
  assert.deepEqual(subscriptionAccess({ status: 'trialing', trialEndsAt: new Date(NOW - 1) }, NOW), { blocked: true, reason: 'trial_expired' });
});

test('em atraso: libera nos 30 dias de tolerância e bloqueia depois (ou sem data de início)', () => {
  const since = (d: number) => ({ status: 'past_due', trialEndsAt: null, pastDueSince: new Date(NOW - d * day) });
  assert.equal(subscriptionAccess(since(1), NOW).blocked, false);
  assert.equal(subscriptionAccess(since(29), NOW).blocked, false);
  assert.deepEqual(subscriptionAccess(since(30), NOW), { blocked: true, reason: 'past_due_expired' });
  assert.deepEqual(subscriptionAccess(since(45), NOW), { blocked: true, reason: 'past_due_expired' });
  assert.deepEqual(subscriptionAccess({ status: 'past_due', trialEndsAt: null }, NOW), { blocked: true, reason: 'past_due_expired' });
  assert.equal(pastDueGrace(since(10), NOW)?.daysLeft, 20);
  assert.equal(pastDueGrace(since(31), NOW), null);
  assert.equal(pastDueGrace({ status: 'active', trialEndsAt: null }, NOW), null);
});

test('sem assinatura, inativa, cancelada ou trial sem data bloqueiam', () => {
  assert.deepEqual(subscriptionAccess(null, NOW), { blocked: true, reason: 'inactive' });
  for (const status of ['inactive', 'canceled']) {
    assert.deepEqual(subscriptionAccess({ status, trialEndsAt: null }, NOW), { blocked: true, reason: 'inactive' });
  }
  assert.equal(subscriptionAccess({ status: 'trialing', trialEndsAt: null }, NOW).blocked, true);
});

test('modo da guarda: padrão é log; só enforce e off mudam o comportamento', () => {
  assert.equal(enforcementMode(undefined), 'log');
  assert.equal(enforcementMode(''), 'log');
  assert.equal(enforcementMode('qualquer'), 'log');
  assert.equal(enforcementMode(' ENFORCE '), 'enforce');
  assert.equal(enforcementMode('off'), 'off');
});

test('sem loja ou com a guarda desligada, a escrita segue sem consultar o banco', async () => {
  assert.deepEqual(await requireActiveSubscription(null, 'enforce'), { ok: true });
  assert.deepEqual(await requireActiveSubscription('loja-x', 'off'), { ok: true });
});
