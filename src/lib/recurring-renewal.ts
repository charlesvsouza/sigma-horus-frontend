import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { todayBR } from '@/lib/date-only';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { endNoticeText, isLegacyGeneratedNumber, renewRecurrence, selectEnding } from '@/lib/recurring-rules';

type Db = Prisma.TransactionClient;

// Fim do período programado das recorrências (ex.: mensalidades geradas até dezembro).
// A diretoria é avisada UMA vez, quando a última cobrança está a até 30 dias, e pode renovar o período
// (mesmo valor, mais N repetições) em Cobranças → "Recorrências chegando ao fim", ou criar um novo período
// pelo formulário de cobrança recorrente. Renovar zera o aviso: se acabar de novo, avisa de novo.

export const MAX_RENEW_REPETITIONS = 36;

export interface EndingMother {
  id: string;
  number: string;
  memberName: string | null;
  amount: number;
  description: string | null;
  /** Vencimento da última cobrança do período (gerada ou ainda por gerar). */
  lastDue: string;
  /** Já gerou a última cobrança: a recorrência parou. */
  ended: boolean;
}

const SELECT = {
  id: true, number: true, amount: true, description: true, nextDueDate: true, recurringInterval: true, recurringCount: true,
  isRecurring: true, recurrenceEndNoticeAt: true, member: { select: { name: true } },
} as const;

type MotherRow = Prisma.InvoiceGetPayload<{ select: typeof SELECT }>;

/** Mães ativas com fim programado, ou já encerradas há pouco (nextDueDate guarda o vencimento seguinte ao da última). */
const WHERE_CANDIDATES = (lodgeId: string): Prisma.InvoiceWhereInput => ({
  lodgeId,
  nextDueDate: { not: null },
  OR: [{ isRecurring: true, recurringCount: { gt: 0 } }, { isRecurring: false, recurringCount: 0 }],
});

export async function loadEndingMothers(db: Db, lodgeId: string, now: Date = new Date()): Promise<EndingMother[]> {
  const rows = await db.invoice.findMany({ where: WHERE_CANDIDATES(lodgeId), select: SELECT });
  return selectEnding(rows, todayBR(now)).map((r) => ({
    id: r.id, number: r.number, memberName: r.member?.name ?? null, amount: Number(r.amount), description: r.description,
    lastDue: r.lastDue.toISOString(), ended: r.ended,
  }));
}

/** Renova as mães escolhidas por mais `repetitions` ocorrências (mesmo valor/intervalo). */
export async function renewMothers(
  db: Db, lodgeId: string, ids: string[], repetitions: number, actorId: string, now: Date = new Date(),
): Promise<{ renewed: number; skipped: number }> {
  const today = todayBR(now);
  const rows = await db.invoice.findMany({ where: { ...WHERE_CANDIDATES(lodgeId), id: { in: ids } }, select: SELECT });
  let renewed = 0;
  for (const row of rows) {
    if (!row.nextDueDate || isLegacyGeneratedNumber(row.number)) continue;
    const next = renewRecurrence(
      { nextDueDate: row.nextDueDate, interval: row.recurringInterval ?? 'monthly', remaining: row.recurringCount, isRecurring: row.isRecurring },
      repetitions, today,
    );
    await db.invoice.update({
      where: { id: row.id },
      data: { nextDueDate: next.nextDueDate, recurringCount: next.remaining, isRecurring: true, recurringInterval: row.recurringInterval ?? 'monthly', recurrenceEndNoticeAt: null },
    });
    renewed++;
  }
  if (renewed > 0) {
    await logAudit(db, { lodgeId, userId: actorId, action: 'UPDATE', entity: 'invoice', entityId: ids[0], metadata: { action: 'recurrence-renew', repetitions, renewed } });
  }
  return { renewed, skipped: ids.length - renewed };
}

/**
 * Cron diário: manda o aviso (uma vez por mãe) ao Tesoureiro, ao Venerável e aos Administradores de cada
 * loja que tem recorrência a até 30 dias do fim.
 */
export async function notifyEndingRecurrences(now: Date = new Date()): Promise<{ lodges: number; mothers: number; emails: number }> {
  const today = todayBR(now);
  const candidates = await prismaAdmin.invoice.findMany({
    where: {
      isRecurring: true, recurringCount: { gt: 0 }, nextDueDate: { not: null }, recurrenceEndNoticeAt: null,
      lodge: { status: 'active' },
    },
    select: { ...SELECT, lodgeId: true },
  });
  const byLodge = new Map<string, MotherRow[]>();
  for (const c of candidates) byLodge.set(c.lodgeId, [...(byLodge.get(c.lodgeId) ?? []), c]);

  const stats = { lodges: 0, mothers: 0, emails: 0 };
  for (const [lodgeId, rows] of byLodge) {
    try {
      const ending = selectEnding(rows, today).filter((r) => !r.ended);
      if (ending.length === 0) continue;
      const ctx = await withTenant(lodgeId, async (db) => {
        // Marca primeiro (e confere na mesma condição): duas rodadas simultâneas não avisam duas vezes.
        const marked = await db.invoice.updateMany({ where: { id: { in: ending.map((e) => e.id) }, recurrenceEndNoticeAt: null }, data: { recurrenceEndNoticeAt: now } });
        if (marked.count === 0) return null;
        const [lodge, staff] = await Promise.all([
          db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true } }),
          db.user.findMany({ where: { lodgeId, role: { in: ['treasurer', 'venerable', 'admin'] }, status: 'active' }, select: { email: true } }),
        ]);
        return { lodge, staff, count: marked.count };
      });
      if (!ctx) continue;
      stats.lodges++;
      stats.mothers += ctx.count;
      const { subject, body } = endNoticeText(ctx.lodge?.name ?? 'a loja', ending.map((e) => e.lastDue));
      for (const to of new Set(ctx.staff.map((u) => u.email).filter(Boolean))) {
        const r = await dispatch('email', to, subject, body, EMPTY_CHANNELS).catch(() => null);
        if (r?.status === 'sent') stats.emails++;
      }
    } catch (err) {
      console.error('recorrência: falha ao avisar o fim do período', { lodgeId, err });
    }
  }
  return stats;
}
