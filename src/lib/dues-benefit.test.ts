import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canGrantDuesBenefit, duesAmountFor, eligibleForAgeConcession, normalizeBenefit } from './dues-benefit.ts';

test('só Venerável e Administrador concedem', () => {
  assert.equal(canGrantDuesBenefit('admin'), true);
  assert.equal(canGrantDuesBenefit('Venerable'), true);
  for (const r of ['treasurer', 'secretary', 'member', '', null, undefined]) assert.equal(canGrantDuesBenefit(r), false);
});

test('valor da mensalidade: Potência só para quem tem o benefício, nunca acima do valor cheio', () => {
  assert.equal(duesAmountFor({ duesPotencyOnly: true }, 220, 110), 110);
  assert.equal(duesAmountFor({ duesPotencyOnly: false }, 220, 110), 220);
  assert.equal(duesAmountFor({ duesPotencyOnly: true }, 220, null), 220);
  assert.equal(duesAmountFor({ duesPotencyOnly: true }, 90, 110), 90);
});

test('concessão por idade: 70 anos completos', () => {
  const ref = new Date('2026-10-05T12:00:00Z');
  assert.equal(eligibleForAgeConcession('1956-10-05', ref), true);
  assert.equal(eligibleForAgeConcession('1956-10-06', ref), false);
  assert.equal(eligibleForAgeConcession(null, ref), false);
});

test('benefícios não se acumulam e o motivo acompanha a Potência', () => {
  assert.deepEqual(normalizeBenefit({ duesExempt: 'true', duesPotencyOnly: 'true', duesPotencyReason: 'age70' }), { duesExempt: true, duesPotencyOnly: false, duesPotencyReason: null });
  assert.deepEqual(normalizeBenefit({ duesPotencyOnly: 'true', duesPotencyReason: 'age70' }), { duesExempt: false, duesPotencyOnly: true, duesPotencyReason: 'age70' });
  assert.equal(normalizeBenefit({ duesPotencyOnly: 'true', duesPotencyReason: 'xx' }).duesPotencyReason, 'lodge');
  assert.deepEqual(normalizeBenefit({}), { duesExempt: false, duesPotencyOnly: false, duesPotencyReason: null });
});
