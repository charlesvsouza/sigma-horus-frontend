import test from 'node:test';
import assert from 'node:assert/strict';
import { buildObjectKey, DOCUMENT_MIME_TYPES, lodgeDocumentPrefix, ownsDocumentKey } from './storage.ts';

test('documento só pode apontar para a pasta da própria loja', () => {
  const key = buildObjectKey('ata março.pdf', lodgeDocumentPrefix('loja-a'));
  assert.ok(key.startsWith('documents/loja-a/'));
  assert.equal(ownsDocumentKey('loja-a', key), true);
  assert.equal(ownsDocumentKey('loja-b', key), false);
  assert.equal(ownsDocumentKey('loja-a', 'documents/2026-10-05T10-00-00-000Z-ata.pdf'), false, 'caminho antigo (sem pasta da loja) não vale para registro novo');
  assert.equal(ownsDocumentKey('loja-a', 'documents/loja-a/../loja-b/x.pdf'), false);
  assert.equal(ownsDocumentKey('loja-a', null), false);
  assert.equal(ownsDocumentKey('loja-a', undefined), false);
});

test('tipos aceitos em Documentos: documentos e imagens; nada executável nem HTML', () => {
  for (const ok of ['application/pdf', 'image/png', 'text/csv']) assert.ok(DOCUMENT_MIME_TYPES.has(ok));
  for (const bad of ['text/html', 'image/svg+xml', 'application/x-msdownload', 'application/octet-stream', '']) assert.ok(!DOCUMENT_MIME_TYPES.has(bad), bad);
});
