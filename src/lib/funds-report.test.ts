import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFundReport, lastMonths, type FundMovementRow } from './funds-report.ts';
import { isFundPurpose } from './funds.ts';

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const mv = (over: Partial<FundMovementRow> & { id: string; date: Date; direction: 'in' | 'out'; amount: number }): FundMovementRow => ({
  title: 'Tronco', category: 'Tronco de Beneficência', method: 'manual', origin: 'other', originLabel: null, donor: null, ...over,
});

const base = {
  movements: [
    mv({ id: 'a', date: d('2026-08-10'), direction: 'in', amount: 30.1, origin: 'session', originLabel: 'Sessão 10/08/2026', donor: 'Doação (irmão)' }),
    mv({ id: 'b', date: d('2026-08-20'), direction: 'in', amount: 20.2, origin: 'campaign', originLabel: 'Cesta básica', donor: 'Fulano', title: 'Doação – Cesta básica', method: 'donation' }),
    mv({ id: 'c', date: d('2026-09-02'), direction: 'in', amount: 50, origin: 'session', originLabel: 'Sessão 02/09/2026', donor: 'Doação (irmão)' }),
    mv({ id: 'd', date: d('2026-09-05'), direction: 'out', amount: 40, title: 'Benemerência – Cesta básica', method: 'fund' }),
  ],
  from: d('2026-09-01'),
  to: d('2026-09-30'),
  now: d('2026-09-30'),
};

test('extrato: saldo inicial do período inclui o que veio antes; saldo final fecha', () => {
  const r = buildFundReport(base);
  // antes de 01/09: 30,10 + 20,20 = 50,30
  assert.equal(r.statement.openingBalance, 50.3);
  // período: +50 −40 = +10  →  60,30
  assert.equal(r.statement.closingBalance, 60.3);
  assert.equal(r.statement.totalIn, 50);
  assert.equal(r.statement.totalOut, 40);
  assert.equal(r.balanceNow, 60.3);
});

test('saldo de hoje não depende do período escolhido', () => {
  const r = buildFundReport({ ...base, from: d('2026-09-01'), to: d('2026-09-03') });
  assert.equal(r.balanceNow, 60.3);
});

test('entradas por origem só consideram o período', () => {
  const r = buildFundReport(base);
  assert.deepEqual(r.entriesByOrigin, { campaign: 0, session: 50, other: 0 });
  const all = buildFundReport({ ...base, from: d('2026-08-01') });
  assert.deepEqual(all.entriesByOrigin, { campaign: 20.2, session: 80.1, other: 0 });
  assert.equal(all.entryDetail[0].label, 'Sessão 02/09/2026');
});

test('saídas por título e doadores agrupam e somam em centavos', () => {
  const r = buildFundReport({ ...base, from: d('2026-08-01') });
  assert.deepEqual(r.exitsByTitle, [{ label: 'Benemerência – Cesta básica', total: 40, count: 1 }]);
  const irmao = r.donors.find((x) => x.label === 'Doação (irmão)');
  assert.equal(irmao?.total, 80.1);
  assert.equal(irmao?.count, 2);
});

test('série mensal cobre 12 meses e soma corretamente', () => {
  const r = buildFundReport(base);
  assert.equal(r.monthly.length, 12);
  assert.equal(r.monthly[11].month, '2026-09');
  assert.equal(r.monthly[11].in, 50);
  assert.equal(r.monthly[11].out, 40);
  assert.equal(r.monthly[11].net, 10);
  assert.equal(r.monthly[10].month, '2026-08');
  assert.equal(r.monthly[10].in, 50.3);
});

test('lastMonths', () => {
  assert.deepEqual(lastMonths(d('2026-02-15'), 3), ['2025-12', '2026-01', '2026-02']);
});

test('isFundPurpose', () => {
  assert.equal(isFundPurpose('tronco'), true);
  assert.equal(isFundPurpose('donations'), true);
  assert.equal(isFundPurpose('general'), false);
  assert.equal(isFundPurpose(undefined), false);
});
