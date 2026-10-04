// Faltas seguidas — regras puras. Decisão do dono (2026-10-04): "falta é falta" (não existe falta justificada) e 3 ou mais
// ausências seguidas nas últimas sessões disparam a sinalização na Visão geral e o e-mail ao Venerável e ao Hospitaleiro.
//
// Definições:
//  - só contam sessões com presença REGISTRADA (a Secretaria marcou alguém) e dos tipos ordinária, magna e extraordinária
//    (tipo "outra", como evento social, não conta);
//  - só conta "ausente" marcado: sem registro do irmão na sessão = "não registrada", que NÃO é falta e interrompe a sequência;
//  - só sessões a partir da iniciação/admissão do irmão, e só irmãos ativos;
//  - a sequência é contada da sessão mais recente para trás, até a primeira presença (ou não registrada).

export const ABSENCE_STREAK = 3;
/** Quantas sessões recentes se examinam (limite de custo; a sequência real raramente passa de 12). */
export const STREAK_WINDOW = 24;
export const STREAK_SESSION_TYPES = ['ordinary', 'magnificent', 'emergency'];

export interface StreakSession { id: string; date: Date; type: string }
export interface StreakMember { id: string; name: string; status: string; joinedAt: Date | null }
/** sessionId → (memberId → 'present' | 'absent'). Sessão sem nenhuma linha = presença não registrada. */
export type AttendanceMap = Map<string, Map<string, string>>;

export interface AbsenceStreak {
  memberId: string;
  memberName: string;
  /** Quantas sessões seguidas ausente (≥ ABSENCE_STREAK). */
  count: number;
  /** Sessão em que a sequência começou (a mais antiga): identifica a sequência para não avisar duas vezes. */
  startSessionId: string;
  /** Sessão mais recente da sequência. */
  lastSessionId: string;
  lastDate: Date;
}

/** Sessões que contam, da mais recente para a mais antiga: tipo válido e presença registrada. */
export function countableSessions(sessions: StreakSession[], attendance: AttendanceMap, now: Date): StreakSession[] {
  return sessions
    .filter((s) => STREAK_SESSION_TYPES.includes(s.type) && s.date.getTime() <= now.getTime() && (attendance.get(s.id)?.size ?? 0) > 0)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, STREAK_WINDOW);
}

export function absenceStreaks(members: StreakMember[], sessions: StreakSession[], attendance: AttendanceMap, now: Date, min = ABSENCE_STREAK): AbsenceStreak[] {
  const recent = countableSessions(sessions, attendance, now);
  const out: AbsenceStreak[] = [];
  for (const m of members) {
    if (m.status !== 'active') continue;
    // sessões desde a admissão (as da janela, da mais recente para a mais antiga)
    const mine = recent.filter((s) => !m.joinedAt || s.date.getTime() >= m.joinedAt.getTime());
    let count = 0;
    for (const s of mine) {
      if (attendance.get(s.id)?.get(m.id) === 'absent') count++;
      else break;
    }
    if (count >= min) {
      out.push({ memberId: m.id, memberName: m.name, count, startSessionId: mine[count - 1].id, lastSessionId: mine[0].id, lastDate: mine[0].date });
    }
  }
  return out.sort((a, b) => b.count - a.count || a.memberName.localeCompare(b.memberName, 'pt-BR'));
}

/** Chave que identifica uma sequência (irmão + sessão em que começou): base para avisar uma vez só. */
export const streakKey = (s: Pick<AbsenceStreak, 'memberId' | 'startSessionId'>) => `${s.memberId}:${s.startSessionId}`;
