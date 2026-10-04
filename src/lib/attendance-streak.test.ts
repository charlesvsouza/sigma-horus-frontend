import test from 'node:test';
import assert from 'node:assert/strict';
import { absenceStreaks, countableSessions, streakKey, type AttendanceMap, type StreakMember, type StreakSession } from './attendance-streak.ts';

const d = (s: string) => new Date(`${s}T22:00:00.000Z`);
const NOW = d('2026-10-20');
const sessions: StreakSession[] = [
  { id: 's1', date: d('2026-09-01'), type: 'ordinary' },
  { id: 's2', date: d('2026-09-08'), type: 'ordinary' },
  { id: 's3', date: d('2026-09-15'), type: 'magnificent' },
  { id: 's4', date: d('2026-09-22'), type: 'ordinary' },
  { id: 's5', date: d('2026-10-06'), type: 'ordinary' },
  { id: 'sx', date: d('2026-10-10'), type: 'other' },     // evento social: não conta
  { id: 's6', date: d('2026-10-13'), type: 'ordinary' },
  { id: 's7', date: d('2026-10-30'), type: 'ordinary' },  // futura: não conta
];
const att = (rows: Record<string, Record<string, string>>): AttendanceMap => new Map(Object.entries(rows).map(([sid, m]) => [sid, new Map(Object.entries(m))]));
const members: StreakMember[] = [
  { id: 'a', name: 'Carlos', status: 'active', joinedAt: d('2020-01-01') },
  { id: 'b', name: 'Roberto', status: 'active', joinedAt: d('2020-01-01') },
  { id: 'c', name: 'Paulo', status: 'active', joinedAt: d('2026-10-01') },   // iniciado há pouco
  { id: 'd', name: 'Eduardo', status: 'inactive', joinedAt: null },
];

test('sessões que contam: tipo válido, presença registrada, não futura, da mais recente para a mais antiga', () => {
  const a = att({ s3: { a: 'present' }, s4: { a: 'present' }, s5: { a: 'absent' }, s6: { a: 'absent' }, s7: { a: 'absent' }, sx: { a: 'absent' }, s2: {} });
  assert.deepEqual(countableSessions(sessions, a, NOW).map((s) => s.id), ['s6', 's5', 's4', 's3']); // s2 sem registro, sx tipo outra, s7 futura
});

test('3 ausências seguidas disparam; presença interrompe; "não registrada" interrompe', () => {
  const a = att({
    s3: { a: 'present', b: 'absent' }, s4: { a: 'absent', b: 'absent' }, s5: { a: 'absent', b: 'absent' }, s6: { a: 'absent', b: 'present' },
  });
  const res = absenceStreaks(members, sessions, a, NOW);
  assert.deepEqual(res.map((r) => [r.memberName, r.count]), [['Carlos', 3]]); // Carlos: s6,s5,s4 ausente, s3 presente. Roberto: s6 presente
  assert.equal(res[0].startSessionId, 's4');
  assert.equal(res[0].lastSessionId, 's6');
  // sem registro do irmão numa sessão registrada = não é falta
  const b = att({ s4: { a: 'absent' }, s5: { b: 'absent' }, s6: { a: 'absent' } });
  assert.deepEqual(absenceStreaks(members, sessions, b, NOW), []);
});

test('a sequência continua contando a cada nova falta', () => {
  const three = att({ s4: { a: 'absent' }, s5: { a: 'absent' }, s6: { a: 'absent' } });
  const four = att({ s3: { a: 'absent' }, s4: { a: 'absent' }, s5: { a: 'absent' }, s6: { a: 'absent' } });
  assert.equal(absenceStreaks(members, sessions, three, NOW)[0].count, 3);
  assert.equal(absenceStreaks(members, sessions, four, NOW)[0].count, 4);
});

test('chave estável quando a sequência cresce para a frente (nova falta depois)', () => {
  const before = att({ s3: { a: 'absent' }, s4: { a: 'absent' }, s5: { a: 'absent' } });
  const nowS = [...sessions.filter((s) => s.id !== 's6')];
  const r1 = absenceStreaks(members, nowS, before, d('2026-10-08'))[0];
  const after = att({ s3: { a: 'absent' }, s4: { a: 'absent' }, s5: { a: 'absent' }, s6: { a: 'absent' } });
  const r2 = absenceStreaks(members, sessions, after, NOW)[0];
  assert.equal(r1.count, 3);
  assert.equal(r2.count, 4);
  assert.equal(streakKey(r1), streakKey(r2)); // mesma sequência (começou em s3): não avisa de novo
});

test('só irmãos ativos e só sessões depois da admissão', () => {
  const a = att({ s4: { c: 'absent', d: 'absent' }, s5: { c: 'absent', d: 'absent' }, s6: { c: 'absent', d: 'absent' } });
  // Paulo foi iniciado em 01/10: só s5 e s6 valem para ele (2 sessões) → não chega a 3. Eduardo está inativo.
  assert.deepEqual(absenceStreaks(members, sessions, a, NOW), []);
});
