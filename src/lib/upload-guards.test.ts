import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMAGE_BYTES, MAX_RECEIPT_BYTES, imageUploadError, receiptUploadError } from './upload-guards.ts';

test('foto de perfil: sem SVG (a não ser o brasão) e até 5 MB', () => {
  assert.equal(imageUploadError({ type: 'image/png', size: 1000 }), null);
  assert.match(imageUploadError({ type: 'image/svg+xml', size: 1000 }) ?? '', /PNG, JPG ou WebP/);
  assert.equal(imageUploadError({ type: 'image/svg+xml', size: 1000 }, { allowSvg: true }), null);
  assert.match(imageUploadError({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 }) ?? '', /5 MB/);
});

test('comprovante do "Já paguei": foto ou PDF, até 4 MB (limite do Vercel) — SVG e outros tipos não', () => {
  assert.equal(receiptUploadError({ type: 'application/pdf', size: 1000 }), null);
  assert.equal(receiptUploadError({ type: 'image/jpeg', size: MAX_RECEIPT_BYTES }), null);
  assert.match(receiptUploadError({ type: 'image/svg+xml', size: 10 }) ?? '', /foto .* ou um PDF/);
  assert.match(receiptUploadError({ type: 'text/html', size: 10 }) ?? '', /PDF/);
  assert.match(receiptUploadError({ type: 'application/pdf', size: MAX_RECEIPT_BYTES + 1 }) ?? '', /4 MB/);
});
