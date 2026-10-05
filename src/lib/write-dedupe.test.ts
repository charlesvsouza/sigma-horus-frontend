import test from 'node:test';
import assert from 'node:assert/strict';
import { createDedupedFetch, writeKey } from './write-dedupe.ts';

function fakeFetch() {
  const calls: string[] = [];
  const releases: (() => void)[] = [];
  const fn = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
    return new Promise<Response>((resolve) => { releases.push(() => resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))); });
  }) as typeof fetch;
  return { fn, calls, release: () => { while (releases.length) releases.shift()?.(); } };
}

test('chave: só gravações com corpo texto; GET, upload e login ficam de fora', () => {
  assert.equal(writeKey('/api/x'), null);
  assert.equal(writeKey('/api/x', { method: 'POST', body: '{"a":1}' }), 'POST /api/x {"a":1}');
  assert.equal(writeKey('/api/x', { method: 'post', body: '{"a":1}' }), 'POST /api/x {"a":1}');
  assert.equal(writeKey('/api/x', { method: 'POST', body: new FormData() }), null);
  assert.equal(writeKey('/api/auth/callback/credentials', { method: 'POST', body: 'a=1' }), null);
});

test('duplo clique: a segunda gravação idêntica em andamento reaproveita a primeira', async () => {
  const f = fakeFetch();
  const guarded = createDedupedFetch(f.fn);
  const a = guarded('/api/payments', { method: 'POST', body: '{"id":1}' });
  const b = guarded('/api/payments', { method: 'POST', body: '{"id":1}' });
  f.release();
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(await ra.json(), { ok: true });
  assert.deepEqual(await rb.json(), { ok: true });
});

test('corpo diferente, ou depois de terminar, é outra ação e grava de novo', async () => {
  const f = fakeFetch();
  const guarded = createDedupedFetch(f.fn);
  const a = guarded('/api/payments', { method: 'POST', body: '{"id":1}' });
  const b = guarded('/api/payments', { method: 'POST', body: '{"id":2}' });
  f.release();
  await Promise.all([a, b]);
  assert.equal(f.calls.length, 2);
  const c = guarded('/api/payments', { method: 'POST', body: '{"id":1}' });
  f.release();
  await c;
  assert.equal(f.calls.length, 3);
});

test('falha de rede em gravação avisa; leitura não', async () => {
  let warned = 0;
  const failing = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
  const guarded = createDedupedFetch(failing, () => { warned++; });
  await assert.rejects(guarded('/api/payments', { method: 'POST', body: '{}' }));
  assert.equal(warned, 1);
  await assert.rejects(guarded('/api/payments'));
  assert.equal(warned, 1);
});
