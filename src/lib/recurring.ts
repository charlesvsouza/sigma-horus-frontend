import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { nextInvoiceNumbers } from '@/lib/charges';
import { todayBR } from '@/lib/date-only';
import { lockKey } from '@/lib/locks';
import { getLodgeOverdueDuesReport, isArt002Enabled, ART_002_THRESHOLD_DAYS, syncMemberArt002Status } from '@/lib/overdue';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { addInterval, isHeldForArt002, isLegacyGeneratedNumber, pendingOccurrences } from '@/lib/recurring-rules';
import { findClosedTermForDate } from '@/lib/term-lock';

type Db = Prisma.TransactionClient;

export const SYSTEM_ACTOR = 'system:recurring-invoices';

export interface RecurringRunResult {
  /** Cobranças geradas nesta rodada. */
  processed: number;
  /** Recorrências paradas porque o membro está no Art. 002 (aguardam o Tesoureiro/Venerável). */
  held: number;
  /** Ocorrências que cairiam num veneralato já encerrado (não geradas). */
  locked: number;
  errors: number;
}

export interface HeldRecurringRow {
  memberId: string;
  memberName: string;
  /** Quantas ocorrências já venceram e ainda não foram geradas. */
  pending: number;
  /** Soma das ocorrências pendentes. */
  total: number;
  oldestDueDate: string;
}

/** Membros retidos no Art. 002: pela situação gravada OU pela regra dos dias em atraso (aplicada na hora). */
async function heldMemberIds(db: Db, lodgeId: string, now: Date): Promise<Set<string>> {
  const [flagged, report, lodge] = await Promise.all([
    db.member.findMany({ where: { lodgeId, status: 'art_002' }, select: { id: true } }),
    getLodgeOverdueDuesReport(db, lodgeId, now),
    db.lodge.findUnique({ where: { id: lodgeId }, select: { art002Enabled: true } }),
  ]);
  const enabled = isArt002Enabled(lodge);
  const held = new Set(flagged.map((m) => m.id));
  for (const row of report) {
    if (isHeldForArt002({ status: row.memberStatus }, row.daysOverdue, enabled, ART_002_THRESHOLD_DAYS)) held.add(row.memberId);
  }
  return held;
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
async function emitOccurrence(lodgeId: string, templateId: string, expectedDue: Date, actorId: string, released: boolean): Promise<Emit> {
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
          description: t.account.description,
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
        description: t.description,
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
      metadata: { action: 'recurring', templateId: t.id, templateNumber: t.number, number, dueDate: dueDate.toISOString(), released },
    });
    return 'created';
  });
}

/**
 * Rodada da loja: no máximo UMA ocorrência por cobrança-mãe (nunca despeja parcelas acumuladas).
 * Membro no Art. 002 fica retido — a recorrência dele espera o Tesoureiro/Venerável liberar.
 */
export async function processRecurringForLodge(lodgeId: string, actorId: string = SYSTEM_ACTOR, now: Date = new Date()): Promise<RecurringRunResult> {
  const today = todayBR(now);
  const { templates, held } = await withTenant(lodgeId, async (db) => ({
    templates: await loadDueTemplates(db, lodgeId, today),
    held: await heldMemberIds(db, lodgeId, now),
  }));

  const result: RecurringRunResult = { processed: 0, held: 0, locked: 0, errors: 0 };
  for (const t of templates) {
    if (t.memberId && held.has(t.memberId)) { result.held++; continue; }
    try {
      const r = await emitOccurrence(lodgeId, t.id, t.nextDueDate!, actorId, false);
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

/**
 * Liberação manual (Tesoureiro/Venerável, depois da negociação): gera de uma vez TODAS as
 * ocorrências vencidas e ainda não geradas das recorrências do membro.
 */
export async function releaseMemberRecurring(lodgeId: string, memberId: string, actorId: string, now: Date = new Date()): Promise<{ generated: number; locked: number }> {
  const today = todayBR(now);
  const templates = await withTenant(lodgeId, (db) => loadDueTemplates(db, lodgeId, today, memberId));

  let generated = 0;
  let locked = 0;
  for (const t of templates) {
    const dates = pendingOccurrences(t.nextDueDate!, t.recurringInterval ?? 'monthly', t.recurringCount, today);
    for (const due of dates) {
      const r = await emitOccurrence(lodgeId, t.id, due, actorId, true);
      if (r === 'created') generated++;
      else { if (r === 'locked') locked++; break; } // ocorrência barrada: as seguintes dependem dela
    }
  }
  await withTenant(lodgeId, (db) => syncMemberArt002Status(db, lodgeId, memberId, now));
  return { generated, locked };
}

/** Recorrências retidas por membro (o que aparece em Cobranças para o Tesoureiro/Venerável liberar). */
export async function listHeldRecurring(db: Db, lodgeId: string, now: Date = new Date()): Promise<HeldRecurringRow[]> {
  const today = todayBR(now);
  const [templates, held] = await Promise.all([loadDueTemplates(db, lodgeId, today), heldMemberIds(db, lodgeId, now)]);

  const byMember = new Map<string, HeldRecurringRow>();
  for (const t of templates) {
    if (!t.memberId || !held.has(t.memberId)) continue;
    const dates = pendingOccurrences(t.nextDueDate!, t.recurringInterval ?? 'monthly', t.recurringCount, today);
    if (dates.length === 0) continue;
    const row = byMember.get(t.memberId) ?? { memberId: t.memberId, memberName: t.member?.name ?? '—', pending: 0, total: 0, oldestDueDate: dates[0].toISOString() };
    row.pending += dates.length;
    row.total += dates.length * Number(t.amount);
    if (dates[0].toISOString() < row.oldestDueDate) row.oldestDueDate = dates[0].toISOString();
    byMember.set(t.memberId, row);
  }
  return [...byMember.values()].sort((a, b) => a.oldestDueDate.localeCompare(b.oldestDueDate));
}
