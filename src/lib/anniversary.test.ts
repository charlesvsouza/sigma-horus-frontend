import test from 'node:test';
import assert from 'node:assert/strict';
import { isAnniversaryToday, todayBR, yearsCompleted } from './anniversary.ts';

test('data do cadastro (meia-noite UTC) faz aniversário no próprio dia, não na véspera', () => {
  const elevacao = new Date('2006-08-23T00:00:00.000Z'); // como o sistema grava
  // cron das 11:00 UTC = 08:00 em Brasília
  assert.equal(isAnniversaryToday(elevacao, todayBR(new Date('2026-08-23T11:00:00Z'))), true);
  assert.equal(isAnniversaryToday(elevacao, todayBR(new Date('2026-08-22T11:00:00Z'))), false);
  assert.equal(yearsCompleted(elevacao, todayBR(new Date('2026-08-23T11:00:00Z'))), 20);
});

test('hoje é o dia de Brasília (23h em Brasília ainda é o mesmo dia)', () => {
  assert.deepEqual(todayBR(new Date('2026-10-03T02:30:00Z')), { y: 2026, m: 10, day: 2 });
});

test('29/02 comemora em 28/02 nos anos não bissextos', () => {
  const nasc = new Date('1980-02-29T00:00:00.000Z');
  assert.equal(isAnniversaryToday(nasc, { y: 2027, m: 2, day: 28 }), true);
  assert.equal(isAnniversaryToday(nasc, { y: 2028, m: 2, day: 28 }), false);
  assert.equal(isAnniversaryToday(nasc, { y: 2028, m: 2, day: 29 }), true);
});
