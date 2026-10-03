import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { nextInvoiceNumbers } from '@/lib/charges';
import { todayBR } from '@/lib/date-only';
import { lockKey } from '@/lib/locks';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { BLOCKED_STATUS } from '@/lib/member-block';
import { addInterval, descriptionForOccurrence, isLegacyGeneratedNumber } from '@/lib/recurring-rules';
import { findClosedTermForDate } from '@/lib/term-lock';

type Db = Prisma.TransactionClient;

export const SYSTEM_ACTOR = 'system:recurring-invoices';

export interface RecurringRunResult {
  /** Cobranças geradas nesta rodada. */
  processed: number;
  /** Recorrências paradas porque o irmão está bloqueado (comunicado à Potência). */
  held: number;
  /** Ocorrências que cairiam num veneralato já encerrado (não geradas). */
  locked: number;
  errors: number;
}

/** Irmãos bloqueados (comunicado à Potência): não recebem cobrança nova, a recorrência deles fica parada. */
async function heldMemberIds(db: Db, lodgeId: string): Promise<Set<string>> {
  const blocked = await db.member.findMany({ where: { lodgeId, status: BLOCKED_STATUS }, select: { id: true } });
  return new Set(blocked.map((m) => m.id));
}

/** Cobranças "mãe" com ocorrência vencida (independe de a mãe estar paga ou em atraso). */
async function loadDueTemplates(db: Db, lodgeId: string, today: Date, memberId?: string) {
  const rows = await db.invoice.findMany({
    where: {
      lodgeId,
      isRecurring: true,
      nextDueDate: { lte: today },
      // recurringCount nulo = sem fim. `{ not: 0 }` exclui NULL no Prisma; por isso o OR explícito.
      OR: [{ recurringCount: null }, { recurringCount: { gt: 0 } }],
      ...(memberId ? { memberId } : {}),
    },
    select: { id: true, number: true, memberId: true, amount: true, nextDueDate: true, recurringInterval: true, recurringCount: true, member: { select: { name: true } } },
    orderBy: { nextDueDate: 'asc' },
  });
  // Filhas geradas pelo código antigo ficaram marcadas como recorrentes: não são mães.
  return rows.filter((r) => !isLegacyGeneratedNumber(r.number));
}

type Emit = 'created' | 'skipped' | 'locked';

/**
 * Gera UMA ocorrência da mãe (a que vence em `expectedDue`) e avança a mãe. Idempotente: com a
 * trava por mãe e a conferência da data esperada, duas execuções simultâneas (cron + clique)
 * nunca geram a mesma ocorrência duas vezes.
 */
async function emitOccurrence(lodgeId: string, templateId: string, expectedDue: Date, actorId: string): Promise<Emit> {
  return withTenant(lodgeId, async (tx) => {
    await lockKey(tx, `recurring:${templateId}`);
    const t = await tx.invoice.findFirst({ where: { id: templateId, lodgeId }, include: { account: true } });
    if (!t || !t.isRecurring || !t.nextDueDate || t.nextDueDate.getTime() !== expectedDue.getTime()) return 'skipped';
    if (t.recurringCount !== null && t.recurringCount <= 0) return 'skipped';

    const dueDate = t.nextDueDate;
    const closed = await findClosedTermForDate(tx, lodgeId, dueDate);
    if (closed) return 'locked';

    const interval = t.recurringInterval ?? 'monthly';
    const remaining = t.recurringCount !== null ? t.recurringCount - 1 : null;
    const hasMore = remaining === null || remaining > 0;

    // Cada ocorrência tem o próprio lançamento (1:1 com o membro): reaproveitar o Account da
    // primeira faria a baixa dela quitar as ocorrências futuras. Contas compartilhadas
    // (cobranças em massa antigas, sem membro) seguem reaproveitadas, como sempre foi.
    let accountId = t.accountId;
    if (t.account.memberId) {
      const account = await tx.account.create({
        data: {
          lodgeId,
          type: 'RECEIVABLE',
          title: t.account.title,
          amount: t.amount,
          dueDate,
          // O mês escrito na 1ª cobrança vira o desta ocorrência ("setembro" → "outubro").
          description: descriptionForOccurrence(t.account.description, t.dueDate, dueDate),
          memberId: t.account.memberId,
          chartAccountId: t.account.chartAccountId,
          isDues: t.account.isDues,
        },
      });
      accountId = account.id;
    }

    const [number] = await nextInvoiceNumbers(tx, lodgeId, 1);
    // A filha NÃO é recorrente: só a mãe gera as próximas. (Antes a filha nascia recorrente e a
    // mãe continuava também — o número de cobranças dobrava a cada ciclo.)
    const child = await tx.invoice.create({
      data: {
        lodgeId,
        accountId,
        memberId: t.memberId,
        number,
        amount: t.amount,
        dueDate,
        description: descriptionForOccurrence(t.description, t.dueDate, dueDate),
        status: 'pending',
        isRecurring: false,
      },
    });

    await tx.invoice.update({
      where: { id: t.id },
      data: { nextDueDate: addInterval(dueDate, interval), recurringCount: remaining, isRecurring: hasMore },
    });

    await logAudit(tx, {
      lodgeId,
      userId: actorId,
      action: 'CREATE',
      entity: 'invoice',
      entityId: child.id,
      metadata: { action: 'recurring', templateId: t.id, templateNumber: t.number, number, dueDate: dueDate.toISOString() },
    });
    return 'created';
  });
}

/**
 * Rodada da loja: no máximo UMA ocorrência por cobrança-mãe (nunca despeja parcelas acumuladas).
 * Irmão bloqueado fica retido; ao voltar, a recorrência recomeça no próximo vencimento (liftBlock).
 */
export async function processRecurringForLodge(lodgeId: string, actorId: string = SYSTEM_ACTOR, now: Date = new Date()): Promise<RecurringRunResult> {
  const today = todayBR(now);
  const { templates, held } = await withTenant(lodgeId, async (db) => ({
    templates: await loadDueTemplates(db, lodgeId, today),
    held: await heldMemberIds(db, lodgeId),
  }));

  const result: RecurringRunResult = { processed: 0, held: 0, locked: 0, errors: 0 };
  for (const t of templates) {
    if (t.memberId && held.has(t.memberId)) { result.held++; continue; }
    try {
      const r = await emitOccurrence(lodgeId, t.id, t.nextDueDate!, actorId);
      if (r === 'created') result.processed++;
      else if (r === 'locked') result.locked++;
    } catch (err) {
      console.error('recorrência: falha ao gerar ocorrência', { lodgeId, templateId: t.id, err });
      result.errors++;
    }
  }
  return result;
}

/** Cron: todas as lojas ativas que têm alguma ocorrência vencida. */
export async function processRecurringAllLodges(now: Date = new Date()): Promise<RecurringRunResult & { lodges: number }> {
  const due = await prismaAdmin.invoice.findMany({
    where: {
      isRecurring: true,
      nextDueDate: { lte: todayBR(now) },
      OR: [{ recurringCount: null }, { recurringCount: { gt: 0 } }],
      lodge: { status: 'active' },
    },
    select: { lodgeId: true },
    distinct: ['lodgeId'],
  });
  const total = { lodges: due.length, processed: 0, held: 0, locked: 0, errors: 0 };
  for (const { lodgeId } of due) {
    try {
      const r = await processRecurringForLodge(lodgeId, SYSTEM_ACTOR, now);
      total.processed += r.processed; total.held += r.held; total.locked += r.locked; total.errors += r.errors;
    } catch (err) {
      console.error('recorrência: falha na loja', { lodgeId, err });
      total.errors++;
    }
  }
  return total;
}
