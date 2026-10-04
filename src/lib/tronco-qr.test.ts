import test from 'node:test';
import assert from 'node:assert/strict';
import { asaasExpiration, qrDescription, qrExpiryFor, qrState } from './tronco-qr.ts';

const at = (iso: string) => new Date(iso);

test('validade: meia-noite (Brasília) do dia seguinte ao da sessão', () => {
  // sessão às 19:00 BRT do dia 06/10 (22:00Z) → vale até 00:00 BRT do dia 07/10 (03:00Z)
  assert.equal(qrExpiryFor(at('2026-10-06T22:00:00Z')).toISOString(), '2026-10-07T03:00:00.000Z');
  // sessão às 23:30 BRT do dia 06 (02:30Z do dia 07) continua sendo dia 06 em Brasília
  assert.equal(qrExpiryFor(at('2026-10-07T02:30:00Z')).toISOString(), '2026-10-07T03:00:00.000Z');
  // virada de mês e de ano
  assert.equal(qrExpiryFor(at('2026-12-31T22:00:00Z')).toISOString(), '2027-01-01T03:00:00.000Z');
});

test('formato de expiração do Asaas em horário de Brasília', () => {
  assert.equal(asaasExpiration(qrExpiryFor(at('2026-10-06T22:00:00Z'))), '2026-10-07 00:00:00');
});

test('estado do QR: ativo até a validade, expirado depois', () => {
  const exp = qrExpiryFor(at('2026-10-06T22:00:00Z'));
  assert.equal(qrState(exp, at('2026-10-07T02:59:59Z')), 'active');
  assert.equal(qrState(exp, at('2026-10-07T03:00:00Z')), 'expired');
});

test('descrição curta e sem acento', () => {
  const d = qrDescription({ title: 'Sessão Magna', date: at('2026-10-06T22:00:00Z') }, 'visitors');
  assert.equal(d, 'Tronco 06/10/26 - visitantes');
  assert.ok(d.length <= 37, 'o Asaas recusa descrição com mais de 37 caracteres');
  assert.doesNotMatch(d, /[^\x20-\x7e]/);
});
