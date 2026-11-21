import test from 'node:test';
import assert from 'node:assert/strict';
import { BANCOS, bancosProntos, bancoPorId, bancoPadrao } from './bank-catalog.ts';

test('Itaú está pronta para uso e tem endpoints de produção e homologação', () => {
  const itau = bancoPorId('itau');
  assert.ok(itau);
  assert.equal(itau.status, 'ready');
  assert.equal(itau.auth, 'oauth2-mtls');
  assert.equal(itau.pixPadrao, 'bacen');
  assert.ok(itau.endpoints?.production.apiBase);
  assert.ok(itau.endpoints?.sandbox?.apiBase);
  assert.notEqual(itau.endpoints?.production.apiBase, itau.endpoints?.sandbox?.apiBase);
  assert.ok(itau.endpoints?.production.boleto, 'boleto do Itaú precisa de caminho');
});

test('a tela só recebe banco pronto', () => {
  const prontos = bancosProntos();
  assert.ok(prontos.length >= 1);
  assert.ok(prontos.every((b) => b.status === 'ready'));
  assert.ok(prontos.every((b) => b.endpoints?.production));
  assert.equal(bancoPadrao()?.id, prontos[0].id);
});

test('banco planejado não tem endpoint e explica o que falta', () => {
  const planejados = BANCOS.filter((b) => b.status === 'planned');
  assert.ok(planejados.length >= 1);
  for (const b of planejados) {
    assert.equal(b.endpoints, undefined);
    assert.ok(b.pendencia && b.pendencia.length > 10);
  }
});

test('id desconhecido não vira banco', () => {
  assert.equal(bancoPorId('banco-inexistente'), undefined);
  assert.equal(bancoPorId(null), undefined);
  assert.equal(bancoPorId(undefined), undefined);
});

test('ids são únicos no catálogo', () => {
  const ids = BANCOS.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
});
