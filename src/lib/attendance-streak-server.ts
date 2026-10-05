import type { Prisma } from '@/generated/prisma/client';
import { absenceStreaks, streakKey, STREAK_SESSION_TYPES, STREAK_WINDOW, ABSENCE_STREAK, type AbsenceStreak, type AttendanceMap } from '@/lib/attendance-streak';
import { formatDateOnly } from '@/lib/date-only';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { memberIdsRestricted } from '@/lib/member-restriction-server';
import { prismaAdmin, withTenant } from '@/lib/prisma';

type Db = Prisma.TransactionClient;

export const ABSENCE_ALERT_ENTITY = 'absence-alert';

/** Irmãos ativos com 3 ou mais ausências seguidas nas últimas sessões da loja (ver lib/attendance-streak). */
export async function listAbsenceStreaks(db: Db, lodgeId: string, now: Date = new Date()): Promise<AbsenceStreak[]> {
  const sessions = await db.session.findMany({
    where: { lodgeId, type: { in: STREAK_SESSION_TYPES }, date: { lte: now } },
    orderBy: { date: 'desc' },
    take: STREAK_WINDOW + 6,
    select: { id: true, date: true, type: true },
  });
  if (sessions.length === 0) return [];
  const onLeave = [...(await memberIdsRestricted(db, lodgeId, ['convocation']))]; // licença: faltas não contam
  const [rows, members] = await Promise.all([
    db.attendance.findMany({ where: { lodgeId, sessionId: { in: sessions.map((s) => s.id) } }, select: { sessionId: true, memberId: true, status: true } }),
    db.member.findMany({ where: { lodgeId, status: 'active', deceased: false, ...(onLeave.length ? { id: { notIn: onLeave } } : {}) }, select: { id: true, name: true, status: true, initiationDate: true } }),
  ]);
  const attendance: AttendanceMap = new Map();
  for (const r of rows) {
    const m = attendance.get(r.sessionId) ?? new Map<string, string>();
    m.set(r.memberId, r.status);
    attendance.set(r.sessionId, m);
  }
  return absenceStreaks(members.map((m) => ({ id: m.id, name: m.name, status: m.status, joinedAt: m.initiationDate })), sessions, attendance, now);
}

/**
 * Cron diário: avisa por e-mail o Venerável e o Hospitaleiro de cada loja sobre irmãos que chegaram a 3 ausências seguidas.
 * Uma vez por sequência (a chave é o irmão + a sessão em que a sequência começou, guardada na auditoria): se o irmão
 * continuar faltando, não repete; só volta a avisar depois que ele comparecer e voltar a faltar 3 vezes.
 */
export async function alertAbsenceStreaks(now: Date = new Date()): Promise<{ lodges: number; alerted: number; emails: number }> {
  const lodges = await prismaAdmin.lodge.findMany({ where: { status: 'active' }, select: { id: true, name: true } });
  const stats = { lodges: 0, alerted: 0, emails: 0 };
  for (const lodge of lodges) {
    try {
      const ctx = await withTenant(lodge.id, async (db) => {
        const streaks = await listAbsenceStreaks(db, lodge.id, now);
        if (streaks.length === 0) return null;
        const keys = streaks.map(streakKey);
        const done = await db.auditLog.findMany({ where: { lodgeId: lodge.id, entity: ABSENCE_ALERT_ENTITY, entityId: { in: keys } }, select: { entityId: true } });
        const doneKeys = new Set(done.map((d) => d.entityId));
        const fresh = streaks.filter((s) => !doneKeys.has(streakKey(s)));
        if (fresh.length === 0) return null;
        // Marca antes de enviar: duas rodadas simultâneas não avisam duas vezes.
        for (const s of fresh) {
          await db.auditLog.create({ data: { lodgeId: lodge.id, userId: null, action: 'CREATE', entity: ABSENCE_ALERT_ENTITY, entityId: streakKey(s), after: JSON.stringify({ memberId: s.memberId, count: s.count, lastSessionId: s.lastSessionId }) } });
        }
        const staff = await db.user.findMany({ where: { lodgeId: lodge.id, role: { in: ['venerable', 'hospitaller'] }, status: 'active' }, select: { email: true } });
        return { fresh, staff };
      });
      if (!ctx) continue;
      stats.lodges++;
      stats.alerted += ctx.fresh.length;
      const lines = ctx.fresh.map((s) => `• ${s.memberName}: ${s.count} ausências seguidas (última sessão em ${formatDateOnly(s.lastDate.toISOString())})`).join('\n');
      const subject = `Irmãos com ${ABSENCE_STREAK} ou mais faltas seguidas — ${lodge.name}`;
      const body =
        `Os irmãos abaixo chegaram a ${ABSENCE_STREAK} ou mais ausências seguidas nas últimas sessões de ${lodge.name}:\n\n${lines}\n\n` +
        `Vale uma visita ou um contato fraterno. Veja o quadro completo em Secretaria → Frequência às sessões. ` +
        `O aviso é enviado uma vez por sequência de faltas.`;
      for (const to of new Set(ctx.staff.map((u) => u.email).filter(Boolean))) {
        const r = await dispatch('email', to, subject, body, EMPTY_CHANNELS).catch(() => null);
        if (r?.status === 'sent') stats.emails++;
      }
    } catch (err) {
      console.error('faltas seguidas: falha ao avisar', { lodgeId: lodge.id, err });
    }
  }
  return stats;
}
