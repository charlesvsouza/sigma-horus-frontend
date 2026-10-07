import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKeyToDate, inLedgerRange, isDayKey, ledgerDayKey, ledgerQueryWindow, todayKeyBR } from './ledger-day.ts';
import { computeAccountStatement, type StatementMovementInput } from './financial-accounts.ts';

test('dia contábil: só-dia vale o dia em UTC; instante vale o dia de Brasília', () => {
  assert.equal(ledgerDayKey(new Date('2026-09-28T00:00:00.000Z')), '2026-09-28');
  // Pix das 22h de Brasília do dia 27 = 01h UTC do dia 28: continua sendo dia 27
  assert.equal(ledgerDayKey(new Date('2026-09-28T01:00:00.000Z')), '2026-09-27');
  // 12h de Brasília do dia 28
  assert.equal(ledgerDayKey(new Date('2026-09-28T15:00:00.000Z')), '2026-09-28');
  assert.equal(ledgerDayKey(new Date('2026-09-29T02:59:59.000Z')), '2026-09-28');
  assert.equal(ledgerDayKey(new Date('2026-09-29T03:00:00.000Z')), '2026-09-29');
});

test('inLedgerRange, isDayKey e dayKeyToDate', () => {
  assert.equal(inLedgerRange(new Date('2026-09-28T00:00:00.000Z'), '2026-09-28', '2026-09-28'), true);
  assert.equal(inLedgerRange(new Date('2026-09-28T01:00:00.000Z'), '2026-09-28', '2026-09-28'), false);
  assert.equal(isDayKey('2026-02-30'), false);
  assert.equal(isDayKey('2026-09-28'), true);
  assert.equal(isDayKey('28/09/2026'), false);
  assert.equal(dayKeyToDate('2026-09-28').toISOString(), '2026-09-28T00:00:00.000Z');
  assert.equal(todayKeyBR(new Date('2026-10-07T02:00:00.000Z')), '2026-10-06');
});

test('janela de consulta cobre o dia inteiro nos dois formatos', () => {
  const w = ledgerQueryWindow('2026-09-28', '2026-09-28');
  assert.ok(new Date('2026-09-28T00:00:00.000Z') >= w.gte && new Date('2026-09-28T00:00:00.000Z') <= w.lte);
  assert.ok(new Date('2026-09-29T02:59:00.000Z') <= w.lte);
});

const mv = (date: string, kind: StatementMovementInput['kind'], amount: number): StatementMovementInput => ({ date: new Date(date), kind, description: 'x', reference: null, amount });

test('extrato de UM dia concorda com o de um período longo (o erro do dia 28)', () => {
  const movements = [
    mv('2026-09-11T00:00:00.000Z', 'payment_in', 1000),
    mv('2026-09-28T01:00:00.000Z', 'payment_in', 50), // Pix das 22h do dia 27 (Brasília)
    mv('2026-09-28T00:00:00.000Z', 'payment_out', 30),
    mv('2026-09-28T15:00:00.000Z', 'payment_in', 20),
  ];
  const longo = computeAccountStatement(0, movements, '2026-01-01', '2026-09-28');
  const dia = computeAccountStatement(0, movements, '2026-09-28', '2026-09-28');
  assert.equal(longo.closingBalance, 1040);
  assert.equal(dia.closingBalance, longo.closingBalance);
  // o Pix das 22h do dia 27 entra na abertura do dia 28, não nas entradas dele
  assert.equal(dia.openingBalance, 1050);
  assert.equal(dia.totalIn, 20);
  assert.equal(dia.totalOut, 30);
  // aceita Date nos dois lados (chamadas antigas)
  const comDate = computeAccountStatement(0, movements, new Date('2026-09-28T00:00:00'), new Date('2026-09-28T23:59:59'));
  assert.equal(comDate.openingBalance, 1050);
});

test('mesmo dia: vale a ordem do lançamento', () => {
  const s = computeAccountStatement(0, [mv('2026-09-28T00:00:00.000Z', 'payment_in', 10), mv('2026-09-28T00:00:00.000Z', 'payment_out', 4)], '2026-09-28', '2026-09-28');
  assert.deepEqual(s.movements.map((m) => m.balance), [10, 6]);
});

test('período de relatório começa em 00:00Z do primeiro dia (não na meia-noite de Brasília)', async () => {
  const { ledgerPeriod } = await import('./ledger-day.ts');
  const { from, to } = ledgerPeriod('2026-09-01', '2026-09-30');
  assert.equal(from.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(to.toISOString(), '2026-09-30T23:59:59.999Z');
  const firstDay = new Date('2026-09-01T00:00:00.000Z'); // pagamento só-dia do 1º dia
  assert.ok(firstDay >= from && firstDay <= to);
});
