import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAttendanceReport, type AttendanceSessionInput } from './attendance-report.ts';

const members = [
  { id: 'm1', name: 'Ir∴ Ana' },
  { id: 'm2', name: 'Ir∴ Bruno' },
];

const sess = (over: Partial<AttendanceSessionInput>): AttendanceSessionInput => ({
  id: 's1', title: 'Sessão ordinária', date: new Date('2026-06-10'), type: 'ordinary', ...over,
});

test('sessão fora do período não conta pra ninguém', () => {
  const r = computeAttendanceReport(
    members,
    [sess({ id: 's1', date: new Date('2026-01-01') })],
    [{ sessionId: 's1', memberId: 'm1', status: 'present' }],
    new Date('2026-06-01'),
    new Date('2026-06-30'),
  );
  assert.equal(r.members.find((m) => m.memberId === 'm1')?.totalSessions, 0);
  assert.equal(r.sessions.length, 0);
});

test('sem registro de presença → não registrada, não é falta nem presença', () => {
  const r = computeAttendanceReport(
    members,
    [sess({ id: 's1', date: new Date('2026-06-10') })],
    [{ sessionId: 's1', memberId: 'm1', status: 'present' }], // m2 nunca foi marcado
    new Date('2026-06-01'),
    new Date('2026-06-30'),
  );
  const m2 = r.members.find((m) => m.memberId === 'm2')!;
  assert.deepEqual({ present: m2.present, absent: m2.absent, unmarked: m2.unmarked }, { present: 0, absent: 0, unmarked: 1 });
  assert.equal(m2.attendanceRate, 0);
});

test('taxa de frequência = presenças / total de sessões do período', () => {
  const sessions = [
    sess({ id: 's1', date: new Date('2026-06-01') }),
    sess({ id: 's2', date: new Date('2026-06-08') }),
    sess({ id: 's3', date: new Date('2026-06-15') }),
    sess({ id: 's4', date: new Date('2026-06-22') }),
  ];
  const records = [
    { sessionId: 's1', memberId: 'm1', status: 'present' },
    { sessionId: 's2', memberId: 'm1', status: 'present' },
    { sessionId: 's3', memberId: 'm1', status: 'absent' },
    { sessionId: 's4', memberId: 'm1', status: 'present' },
  ];
  const r = computeAttendanceReport(members, sessions, records, new Date('2026-06-01'), new Date('2026-06-30'));
  const m1 = r.members.find((m) => m.memberId === 'm1')!;
  assert.equal(m1.totalSessions, 4);
  assert.equal(m1.present, 3);
  assert.equal(m1.absent, 1);
  assert.equal(m1.attendanceRate, 0.75);
});

test('faltas consecutivas: conta a partir da sessão mais recente, ignora não registradas, para na primeira presença', () => {
  const sessions = [
    sess({ id: 's1', date: new Date('2026-06-01') }), // present — não deve contar
    sess({ id: 's2', date: new Date('2026-06-08') }), // absent
    sess({ id: 's3', date: new Date('2026-06-15') }), // não registrada — pulada
    sess({ id: 's4', date: new Date('2026-06-22') }), // absent (mais recente)
  ];
  const records = [
    { sessionId: 's1', memberId: 'm1', status: 'present' },
    { sessionId: 's2', memberId: 'm1', status: 'absent' },
    { sessionId: 's4', memberId: 'm1', status: 'absent' },
  ];
  const r = computeAttendanceReport(members, sessions, records, new Date('2026-06-01'), new Date('2026-06-30'));
  const m1 = r.members.find((m) => m.memberId === 'm1')!;
  assert.equal(m1.consecutiveAbsences, 2); // s4 e s2 (s3 pulada, s1 é presença e não é alcançada de qualquer forma)
});

test('lista de sessões: soma presente+ausente+não registrada bate com o total de membros', () => {
  const sessions = [sess({ id: 's1', date: new Date('2026-06-10') })];
  const records = [{ sessionId: 's1', memberId: 'm1', status: 'present' }];
  const r = computeAttendanceReport(members, sessions, records, new Date('2026-06-01'), new Date('2026-06-30'));
  const s1 = r.sessions[0];
  assert.equal(s1.present + s1.absent + s1.unmarked, members.length);
  assert.equal(s1.total, members.length);
});

test('membros ordenados alfabeticamente por nome, independente da taxa de frequência', () => {
  const sessions = [sess({ id: 's1', date: new Date('2026-06-10') })];
  // m2 (Bruno) tem frequência pior que m1 (Ana), mas a ordem tem que continuar A→Z por nome.
  const records = [{ sessionId: 's1', memberId: 'm1', status: 'present' }, { sessionId: 's1', memberId: 'm2', status: 'absent' }];
  const r = computeAttendanceReport(members, sessions, records, new Date('2026-06-01'), new Date('2026-06-30'));
  assert.equal(r.members[0].memberId, 'm1');
  assert.equal(r.members[1].memberId, 'm2');
});
