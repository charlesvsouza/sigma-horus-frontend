import test from 'node:test';
import assert from 'node:assert/strict';
import { buildObjectKey, buildPublicUrl, getR2StorageSettings } from './storage.ts';

test('builds a public URL from a configured base URL', () => {
  const url = buildPublicUrl('documents/demo/file.pdf', 'https://cdn.example.com');
  assert.equal(url, 'https://cdn.example.com/documents/demo/file.pdf');
});

test('encodes storage keys when building public URLs', () => {
  const url = buildPublicUrl('documents/space name/file.pdf', 'https://cdn.example.com');
  assert.equal(url, 'https://cdn.example.com/documents/space%20name/file.pdf');
});

test('builds a normalized object key for Cloudflare R2 uploads', () => {
  const key = buildObjectKey('Meu Documento.pdf', 'documents');
  assert.match(key, /^documents\//);
  assert.match(key, /Meu-Documento\.pdf$/);
});

test('reads Cloudflare R2 settings from environment variables', () => {
  process.env.R2_ACCESS_KEY_ID = 'access';
  process.env.R2_SECRET_ACCESS_KEY = 'secret';
  process.env.R2_BUCKET = 'sygmahorus-documents';
  process.env.R2_ENDPOINT = 'https://accountid.r2.cloudflarestorage.com';
  process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL = 'https://cdn.example.com';

  const settings = getR2StorageSettings();

  assert.equal(settings.bucket, 'sygmahorus-documents');
  assert.equal(settings.endpoint, 'https://accountid.r2.cloudflarestorage.com');
  assert.equal(settings.publicUrl, 'https://cdn.example.com');
});
