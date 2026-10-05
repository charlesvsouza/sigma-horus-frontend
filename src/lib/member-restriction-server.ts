import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { todayBR } from '@/lib/date-only';
import { lockKey } from '@/lib/locks';
import { symbolicSituation } from '@/lib/masonic-degree';
import { loadMemberDebts } from '@/lib/member-block-server';
import { checkRestriction, restrictionTargetStatus, type RestrictionInput, type RestrictionScope } from '@/lib/member-restriction';
import { remainingAmount, round2 } from '@/lib/money';
import { withTenant } from '@/lib/prisma';

type Db = Prisma.TransactionClient;
type Fail = { ok: false; status: number; error: string };

/** Restrições em vigor (todas as do irmão, ou de todos os irmãos da loja), da mais nova para a mais antiga. */
export async function activeRestrictions(db: Db, lodgeId: string, memberId?: string) {
  return db.memberRestriction.findMany({
    where: { lodgeId, status: 'active', ...(memberId ? { memberId } : {}) },
    orderBy: { startedAt: 'desc' },
  });
}

/** Ids dos irmãos com restrição em vigor num dos alcances (ex.: licença sai da convocação e do aviso de faltas). */
export async function memberIdsRestricted(db: Db, lodgeId: string, scopes: RestrictionScope[]): Promise<Set<string>> {
  const rows = await db.memberRestriction.findMany({ where: { lodgeId, status: 'active', scope: { in: scopes } }, select: { memberId: true } });
  return new Set(rows.map((r) => r.memberId));
}

/** Registra a restrição: valida contra o motivo (artigo), grava o ato e, se total, muda a situação do cadastro. */
export async function applyRestriction(
  lodgeId: string,
  memberId: string,
  actorId: string,
  input: RestrictionInput,
  now: Date = new Date(),
): Promise<{ ok: true; id: string } | Fail> {
  return withTenant(lodgeId, async (db): Promise<{ ok: true; id: string } | Fail> => {
    await lockKey(db, `member-restriction:${memberId}`);
    const member = await db.member.findFirst({
      where: { id: memberId, lodgeId },
      select: { id: true, name: true, status: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true },
    });
    if (!member) return { ok: false, status: 404, error: 'Membro não encontrado.' };

    const today = todayBR(now);
    const debts = await loadMemberDebts(db, lodgeId, memberId);
    const open = debts.map((d) => ({ due: d.dueDate, left: remainingAmount(d.amount, d.paid) }));
    const openDebt = round2(open.reduce((s, d) => s + d.left, 0));
    const overdueDebt = round2(open.filter((d) => d.due.getTime() < today.getTime()).reduce((s, d) => s + d.left, 0));
    const existing = await db.memberRestriction.findFirst({ where: { lodgeId, memberId, status: 'active', kind: input.kind }, select: { id: true } });

    const check = checkRestriction(input, { memberStatus: member.status, degree: symbolicSituation(member), openDebt, overdueDebt, hasActiveOfKind: Boolean(existing) });
    if (!check.ok) return { ok: false, status: 409, error: check.error };

    const target = restrictionTargetStatus(input.kind);
    const created = await db.memberRestriction.create({
      data: {
        lodgeId, memberId, kind: input.kind, scope: check.def.scope, startedAt: input.startedAt, startedById: actorId,
        deliberatedAt: input.deliberatedAt, expectedEndAt: input.expectedEndAt,
        reason: input.reason.trim() || null, destination: input.destination.trim() || null, protocol: input.protocol.trim() || null,
        previousStatus: target ? member.status : null,
      },
      select: { id: true },
    });
    if (target) await db.member.update({ where: { id: memberId }, data: { status: target } });
    await logAudit(db, { lodgeId, userId: actorId, action: 'CREATE', entity: 'member-restriction', entityId: created.id, metadata: { kind: input.kind, scope: check.def.scope, memberId, status: target } });
    return { ok: true, id: created.id };
  });
}

/**
 * Encerra a restrição (cumprimento, reabilitação, readmissão, retorno da licença...). Se ela mudou a situação
 * do cadastro e ele ainda está nessa situação, o irmão volta à situação anterior; se alguém já a mudou à mão,
 * a situação atual é respeitada.
 */
export async function endRestriction(lodgeId: string, restrictionId: string, actorId: string, endNote: string, now: Date = new Date()): Promise<{ ok: true } | Fail> {
  return withTenant(lodgeId, async (db): Promise<{ ok: true } | Fail> => {
    const r = await db.memberRestriction.findFirst({ where: { id: restrictionId, lodgeId } });
    if (!r) return { ok: false, status: 404, error: 'Restrição não encontrada.' };
    await lockKey(db, `member-restriction:${r.memberId}`);
    if (r.status !== 'active') return { ok: false, status: 409, error: 'Esta restrição já foi encerrada.' };

    await db.memberRestriction.update({ where: { id: r.id }, data: { status: 'ended', endedAt: now, endedById: actorId, endNote: endNote.trim() || null } });
    const target = restrictionTargetStatus(r.kind);
    if (target) {
      const member = await db.member.findFirst({ where: { id: r.memberId, lodgeId }, select: { status: true } });
      if (member?.status === target) await db.member.update({ where: { id: r.memberId }, data: { status: r.previousStatus ?? 'active' } });
    }
    await logAudit(db, { lodgeId, userId: actorId, action: 'UPDATE', entity: 'member-restriction', entityId: r.id, metadata: { action: 'end', memberId: r.memberId, kind: r.kind } });
    return { ok: true };
  });
}
