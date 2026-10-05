import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMessage, fingerprint, isNoise, normalizeRoute, shouldAlert } from './error-monitor-core.ts';

test('rota: ids e números viram :id, query some', () => {
  assert.equal(normalizeRoute('/api/members/cm1abcdefghijklmnopqrstu/block?x=1'), '/api/members/:id/block');
  assert.equal(normalizeRoute('/api/sessions/123/minutes'), '/api/sessions/:id/minutes');
  assert.equal(normalizeRoute('/dashboard/contas'), '/dashboard/contas');
});

test('mesmo erro com ids/números diferentes = mesma impressão digital; rota ou texto diferente não', () => {
  const a = fingerprint('server', '/api/x/cm1abcdefghijklmnopqrstu', 'Registro 123 não encontrado');
  const b = fingerprint('server', '/api/x/cm9zzzzzzzzzzzzzzzzzzzzz', 'Registro 987 não encontrado');
  assert.equal(a, b);
  assert.notEqual(a, fingerprint('server', '/api/y', 'Registro 123 não encontrado'));
  assert.notEqual(a, fingerprint('client', '/api/x/cm1abcdefghijklmnopqrstu', 'Registro 123 não encontrado'));
  assert.notEqual(a, fingerprint('server', '/api/x/cm1abcdefghijklmnopqrstu', 'Outro problema'));
});

test('mensagem: só a primeira linha, com limite', () => {
  assert.equal(cleanMessage('linha 1\nlinha 2'), 'linha 1');
  assert.equal(cleanMessage(new Error('boom')), 'boom');
  assert.equal(cleanMessage(''), '(sem mensagem)');
  assert.equal(cleanMessage('x'.repeat(900)).length, 500);
});

test('ruído: redirect, 404 do Next e conexão cancelada não são falhas', () => {
  assert.equal(isNoise('NEXT_REDIRECT'), true);
  assert.equal(isNoise('x', 'NEXT_NOT_FOUND'), true);
  assert.equal(isNoise('Failed to fetch'), true);
  assert.equal(isNoise('Cannot read properties of undefined'), false);
});

test('alerta: novo, reaberto e lembrete diário; não repete antes disso', () => {
  const now = new Date('2026-10-05T12:00:00Z');
  assert.equal(shouldAlert(null, now), true);
  assert.equal(shouldAlert({ lastAlertedAt: new Date('2026-10-05T10:00:00Z'), resolvedAt: null }, now), false);
  assert.equal(shouldAlert({ lastAlertedAt: new Date('2026-10-04T11:00:00Z'), resolvedAt: null }, now), true);
  assert.equal(shouldAlert({ lastAlertedAt: new Date('2026-10-05T10:00:00Z'), resolvedAt: new Date('2026-10-05T11:00:00Z') }, now), true);
});
