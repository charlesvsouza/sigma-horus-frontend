import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicUrl } from './storage.ts';

test('builds a public URL from a configured base URL', () => {
  const url = buildPublicUrl('documents/demo/file.pdf', 'https://cdn.example.com');
  assert.equal(url, 'https://cdn.example.com/documents/demo/file.pdf');
});

test('encodes storage keys when building public URLs', () => {
  const url = buildPublicUrl('documents/space name/file.pdf', 'https://cdn.example.com');
  assert.equal(url, 'https://cdn.example.com/documents/space%20name/file.pdf');
});
