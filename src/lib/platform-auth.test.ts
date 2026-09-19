import test from 'node:test';
import assert from 'node:assert/strict';
import { cronAuthorized, platformAuthorized, safeEqual } from './platform-auth.ts';

const req = (headers: Record<string, string>, url = 'http://x/api') => new Request(url, { headers });

test('safeEqual compara em tamanho e conteúdo', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});

test('cron: aceita Bearer com o segredo e NÃO aceita ?token= na URL', () => {
  process.env.CRON_SECRET = 'segredo-cron';
  process.env.PLATFORM_OWNER_TOKEN = 'token-dono';
  assert.equal(cronAuthorized(req({ authorization: 'Bearer segredo-cron' })), true);
  assert.equal(cronAuthorized(req({ authorization: 'Bearer token-dono' })), true);
  assert.equal(cronAuthorized(req({ authorization: 'Bearer errado' })), false);
  assert.equal(cronAuthorized(req({}, 'http://x/api?token=segredo-cron')), false);
  assert.equal(cronAuthorized(req({})), false);
});

test('plataforma: exige o header x-platform-token e recusa quando não há token configurado', () => {
  process.env.PLATFORM_OWNER_TOKEN = 'token-dono';
  assert.equal(platformAuthorized(req({ 'x-platform-token': 'token-dono' })), true);
  assert.equal(platformAuthorized(req({ 'x-platform-token': 'outro' })), false);
  delete process.env.PLATFORM_OWNER_TOKEN;
  assert.equal(platformAuthorized(req({ 'x-platform-token': 'token-dono' })), false);
});
