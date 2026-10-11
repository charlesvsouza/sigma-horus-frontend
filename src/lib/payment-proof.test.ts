import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proofPrefix, readProofRef } from './payment-proof';

const lodge = 'loja1';
const key = `${proofPrefix(lodge)}2026-10-10T10-00-00-nota.pdf`;

test('sem comprovante na baixa: ref nula (quem exige decide)', () => {
  assert.deepEqual(readProofRef(lodge, {}), { ok: true, ref: null });
  assert.deepEqual(readProofRef(lodge, { proofKey: '  ' }), { ok: true, ref: null });
});

test('comprovante válido: chave da loja, tipo permitido, nome aparado', () => {
  const r = readProofRef(lodge, { proofKey: key, proofName: 'nota.pdf', proofType: 'application/pdf' });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.ref, { key, name: 'nota.pdf', type: 'application/pdf' });
});

test('chave de outra loja ou com caminho estranho é recusada', () => {
  assert.equal(readProofRef(lodge, { proofKey: `${proofPrefix('outra')}x.pdf`, proofType: 'application/pdf' }).ok, false);
  assert.equal(readProofRef(lodge, { proofKey: `${proofPrefix(lodge)}../outra/x.pdf`, proofType: 'application/pdf' }).ok, false);
  assert.equal(readProofRef(lodge, { proofKey: 'documents/loja1/x.pdf', proofType: 'application/pdf' }).ok, false);
});

test('tipo fora da lista é recusado', () => {
  assert.equal(readProofRef(lodge, { proofKey: key, proofType: 'image/svg+xml' }).ok, false);
  assert.equal(readProofRef(lodge, { proofKey: key, proofType: 'text/html' }).ok, false);
  assert.equal(readProofRef(lodge, { proofKey: key }).ok, false);
});
