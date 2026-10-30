import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignFileError } from './campaign-files';

test('aceita PDF e foto até 4 MB', () => {
  assert.equal(campaignFileError({ type: 'application/pdf', size: 1000 }), null);
  assert.equal(campaignFileError({ type: 'image/jpeg', size: 4 * 1024 * 1024 }), null);
});

test('recusa tipo estranho e arquivo grande, falando em "documento"', () => {
  assert.match(campaignFileError({ type: 'image/svg+xml', size: 10 }) ?? '', /^O documento precisa ser/);
  assert.match(campaignFileError({ type: 'application/pdf', size: 5 * 1024 * 1024 }) ?? '', /^O documento passa de 4 MB/);
});
