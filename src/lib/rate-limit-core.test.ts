import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, rateLimitKey, retryAfterSeconds } from './rate-limit-core.ts';

const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

test('clientIp prefere x-real-ip, depois o 1º de x-forwarded-for', () => {
  assert.equal(clientIp(h({ 'x-real-ip': '200.1.2.3', 'x-forwarded-for': '9.9.9.9' })), '200.1.2.3');
  assert.equal(clientIp(h({ 'x-forwarded-for': ' 200.1.2.3 , 10.0.0.1' })), '200.1.2.3');
});

test('clientIp sem cabeçalho devolve null (quem chama não limita)', () => {
  assert.equal(clientIp(h({})), null);
  assert.equal(clientIp(null), null);
  assert.equal(clientIp(h({ 'x-real-ip': '   ' })), null);
});

test('clientIp limita o tamanho (cabeçalho gigante não vira chave gigante)', () => {
  assert.equal(clientIp(h({ 'x-real-ip': 'a'.repeat(500) }))?.length, 64);
});

test('rateLimitKey separa escopos do mesmo IP', () => {
  assert.notEqual(rateLimitKey('login', '1.1.1.1'), rateLimitKey('signup', '1.1.1.1'));
  assert.equal(rateLimitKey('login', '1.1.1.1'), 'login:1.1.1.1');
});

test('retryAfterSeconds arredonda para cima e nunca é menor que 1', () => {
  const now = Date.parse('2026-09-20T12:00:00Z');
  assert.equal(retryAfterSeconds(new Date(now + 90_500), now), 91);
  assert.equal(retryAfterSeconds(new Date(now - 5_000), now), 1);
});
