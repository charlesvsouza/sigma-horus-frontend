// Lógica pura do relatório de frequência às sessões — separada da rota pra
// ser testável sem Prisma, mesmo espírito de lib/closing.ts e
// lib/financial-accounts.ts. Fonte: Session + Attendance (status 'present' |
// 'absent'; ausência de registro = "não registrada", terceiro estado — nunca
// tratado como presença nem falta, pra não fingir dado que não existe).

export interface AttendanceMemberInput {
  id: string;
  name: string;
}

export interface AttendanceSessionInput {
  id: string;
  title: string;
  date: Date;
  type: string;
}

export interface AttendanceRecordInput {
  sessionId: string;
  memberId: string;
  status: string; // 'present' | 'absent'
}

export interface MemberAttendanceStat {
  memberId: string;
  memberName: string;
  totalSessions: number;
  present: number;
  absent: number;
  unmarked: number;
  attendanceRate: number; // present / totalSessions (0 quando não há sessão no período)
  consecutiveAbsences: number; // faltas seguidas até a sessão mais recente do período, ignorando não registradas
}

export interface SessionAttendanceSummary {
  sessionId: string;
  title: string;
  date: string;
  type: string;
  present: number;
  absent: number;
  unmarked: number;
  total: number;
}

export interface AttendanceReport {
  members: MemberAttendanceStat[];
  sessions: SessionAttendanceSummary[];
}

export function computeAttendanceReport(
  members: AttendanceMemberInput[],
  sessions: AttendanceSessionInput[],
  records: AttendanceRecordInput[],
  from: Date,
  to: Date,
): AttendanceReport {
  const periodSessions = sessions
    .filter((s) => s.date >= from && s.date <= to)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const statusOf = new Map<string, string>();
  for (const r of records) statusOf.set(`${r.sessionId}:${r.memberId}`, r.status);

  const memberStats: MemberAttendanceStat[] = members
    .map((m) => {
      let present = 0;
      let absent = 0;
      let unmarked = 0;
      for (const s of periodSessions) {
        const st = statusOf.get(`${s.id}:${m.id}`);
        if (st === 'present') present++;
        else if (st === 'absent') absent++;
        else unmarked++;
      }

      let consecutiveAbsences = 0;
      for (let i = periodSessions.length - 1; i >= 0; i--) {
        const st = statusOf.get(`${periodSessions[i].id}:${m.id}`);
        if (st === 'present') break;
        if (st === 'absent') consecutiveAbsences++;
        // não registrada: nem quebra nem conta a sequência — ausência de dado não é sinal.
      }

      const totalSessions = periodSessions.length;
      return {
        memberId: m.id,
        memberName: m.name,
        totalSessions,
        present,
        absent,
        unmarked,
        attendanceRate: totalSessions > 0 ? present / totalSessions : 0,
        consecutiveAbsences,
      };
    })
    .sort((a, b) => a.memberName.localeCompare(b.memberName));

  const sessionSummaries: SessionAttendanceSummary[] = periodSessions.map((s) => {
    let present = 0;
    let absent = 0;
    let unmarked = 0;
    for (const m of members) {
      const st = statusOf.get(`${s.id}:${m.id}`);
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else unmarked++;
    }
    return { sessionId: s.id, title: s.title, date: s.date.toISOString(), type: s.type, present, absent, unmarked, total: members.length };
  });

  return { members: memberStats, sessions: sessionSummaries };
}
