import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSessionFor, canConfirmTronco, canDeclareTronco, generateTroncoCode, isTroncoSource, sessionWindow, summarizeBySession, type SessionLike } from './tronco-session.ts';

const at = (iso: string) => new Date(iso);
const S = (id: string, date: string, endDate?: string): SessionLike => ({ id, title: id, date: at(date), endDate: endDate ? at(endDate) : null });

test('quem declara e quem confirma o Tronco', () => {
  for (const r of ['admin', 'venerable', 'treasurer']) { assert.equal(canConfirmTronco(r), true, r); assert.equal(canDeclareTronco(r), true, r); }
  assert.equal(canConfirmTronco('hospitaller'), false);
  assert.equal(canDeclareTronco('hospitaller'), true);   // declara, fica aguardando
  for (const r of ['secretary', 'member', 'candidate', '', null, undefined]) { assert.equal(canConfirmTronco(r), false, String(r)); assert.equal(canDeclareTronco(r), false, String(r)); }
});

test('DNA TR-XXXX-XXXX', () => {
  for (let i = 0; i < 40; i++) assert.match(generateTroncoCode(), /^TR-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.ok(isTroncoSource('visitors') && !isTroncoSource('x'));
});

test('janela da sessão: 2 h antes até o fim + 3 h (4 h de duração quando não há fim)', () => {
  const s = S('a', '2026-10-06T22:00:00Z');                                  // 19:00 BRT
  const w = sessionWindow(s);
  assert.equal(new Date(w.start).toISOString(), '2026-10-06T20:00:00.000Z');
  assert.equal(new Date(w.end).toISOString(), '2026-10-07T05:00:00.000Z');   // 22:00 + 4 h + 3 h
  const withEnd = sessionWindow(S('b', '2026-10-06T22:00:00Z', '2026-10-07T01:00:00Z'));
  assert.equal(new Date(withEnd.end).toISOString(), '2026-10-07T04:00:00.000Z');
});

test('sessão ativa: na janela; com duas, a que começou por último; sem janela, a do mesmo dia; senão nenhuma', () => {
  const list = [S('manha', '2026-10-06T13:00:00Z'), S('noite', '2026-10-06T22:00:00Z'), S('outra', '2026-10-13T22:00:00Z')];
  assert.equal(activeSessionFor(list, at('2026-10-06T23:30:00Z'))?.id, 'noite');                // durante a noite
  assert.equal(activeSessionFor(list, at('2026-10-06T14:00:00Z'))?.id, 'manha');                // durante a manhã
  // 17:30Z: dentro da janela da manhã (11:00–20:00Z) e fora da noite (20:00Z em diante)
  assert.equal(activeSessionFor(list, at('2026-10-06T17:30:00Z'))?.id, 'manha');
  // às 20:30Z as duas janelas valem (manhã vai até 20:00Z? não): só a noite
  assert.equal(activeSessionFor(list, at('2026-10-06T20:30:00Z'))?.id, 'noite');
  // dia seguinte de manhã (fora de qualquer janela e outro dia): nenhuma
  assert.equal(activeSessionFor(list, at('2026-10-07T12:00:00Z')), null);
  // mesmo dia civil, mas fora da janela (madrugada seguinte ainda é o dia da sessão em Brasília? 02:00Z = 23:00 do dia 6)
  assert.equal(activeSessionFor([S('x', '2026-10-06T10:00:00Z')], at('2026-10-06T23:00:00Z'))?.id, 'x');
  assert.equal(activeSessionFor([], at('2026-10-06T23:00:00Z')), null);
});

test('totais por sessão: confirmado, aguardando e divisão por origem; recusada fora; sem sessão separada', () => {
  const rows = summarizeBySession([
    { sessionId: 's1', amount: 100.10, status: 'confirmed', source: 'members' },
    { sessionId: 's1', amount: 50.05, status: 'confirmed', source: 'visitors' },
    { sessionId: 's1', amount: 20, status: 'confirmed', source: null },
    { sessionId: 's1', amount: 30, status: 'pending', source: 'members' },
    { sessionId: 's1', amount: 999, status: 'rejected', source: 'members' },
    { sessionId: null, amount: 10, status: 'confirmed', source: 'mixed' },
  ]);
  const s1 = rows.find((r) => r.sessionId === 's1')!;
  assert.deepEqual({ confirmed: s1.confirmed, pending: s1.pending, ...s1.bySource }, { confirmed: 170.15, pending: 30, members: 100.1, visitors: 50.05, mixed: 20 });
  assert.equal(rows.find((r) => r.sessionId === null)!.confirmed, 10);
  assert.equal(rows.length, 2);
});
