import test from 'node:test';
import assert from 'node:assert/strict';
import { daysOverdueBR, formatDateOnly, todayBR } from './date-only.ts';

// Vencimento gravado como o servidor grava (new Date('AAAA-MM-DD') = 00:00 UTC).
const due = new Date('2026-09-20');

test('formata o dia certo independentemente do fuso do processo', () => {
  assert.equal(formatDateOnly(due), '20/09/2026');
  assert.equal(formatDateOnly('2026-09-20T00:00:00.000Z'), '20/09/2026');
  // meio-dia UTC (outra convenção de gravação) também dá o mesmo dia
  assert.equal(formatDateOnly('2026-09-20T12:00:00.000Z'), '20/09/2026');
});

test('ausente ou inválida usa o fallback', () => {
  assert.equal(formatDateOnly(null), '—');
  assert.equal(formatDateOnly(undefined, ''), '');
  assert.equal(formatDateOnly('lixo'), '—');
});

test('hoje é medido no calendário de Brasília', () => {
  // 21/09 01:00 UTC = 20/09 22:00 em Brasília -> ainda é dia 20
  assert.equal(todayBR(new Date('2026-09-21T01:00:00Z')).toISOString(), '2026-09-20T00:00:00.000Z');
  // 20/09 03:00 UTC = 20/09 00:00 em Brasília -> já é dia 20
  assert.equal(todayBR(new Date('2026-09-20T03:00:00Z')).toISOString(), '2026-09-20T00:00:00.000Z');
  // 20/09 02:59 UTC = 19/09 23:59 em Brasília -> ainda dia 19
  assert.equal(todayBR(new Date('2026-09-20T02:59:00Z')).toISOString(), '2026-09-19T00:00:00.000Z');
});

test('vence hoje NÃO está vencido; só no dia seguinte (fim do bug de 3h antes)', () => {
  // véspera às 22h em Brasília (= 01:00 UTC do dia 20): antes contava como vencido
  assert.equal(daysOverdueBR(due, new Date('2026-09-20T01:00:00Z')), -1);
  // dia do vencimento, meio-dia em Brasília
  assert.equal(daysOverdueBR(due, new Date('2026-09-20T15:00:00Z')), 0);
  // dia seguinte, 00:30 em Brasília
  assert.equal(daysOverdueBR(due, new Date('2026-09-21T03:30:00Z')), 1);
  // 60 dias depois
  assert.equal(daysOverdueBR(due, new Date('2026-11-19T15:00:00Z')), 60);
});
