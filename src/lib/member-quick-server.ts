import type { Prisma } from '@/generated/prisma/client';
import { PLAN_INCLUDE, presentPlan } from '@/lib/degree-fee-server';
import { todayBR } from '@/lib/date-only';
import { symbolicSituation } from '@/lib/masonic-degree';
import { memberStatusLabel } from '@/lib/member-status';
import { buildFinancial, type QuickAccess } from '@/lib/member-quick';
import { getMemberDuesStatus, isArt002Enabled } from '@/lib/overdue';
import { ART_002_THRESHOLD_DAYS } from '@/lib/overdue-rules';

type Db = Prisma.TransactionClient;

/**
 * Dados do painel rápido do irmão, já filtrados pelo que o cargo pode ver (`access`). Só leitura.
 * Lançamentos de categoria de solidariedade (Tronco/doações) ficam de fora: o sigilo do doador é decidido em outro lugar
 * e o painel não pode abrir uma porta lateral.
 */
export async function loadMemberQuick(db: Db, lodgeId: string, memberId: string, access: QuickAccess, now: Date = new Date()) {
  const member = await db.member.findFirst({
    where: { id: memberId, lodgeId },
    select: {
      id: true, name: true, status: true, email: true, phone: true,
      initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true,
    },
  });
  if (!member) return null;

  const base = {
    id: member.id,
    name: member.name,
    degree: symbolicSituation(member),
    status: member.status,
    statusLabel: memberStatusLabel(member.status),
    access,
    contact: access.contact ? { email: member.email ?? null, phone: member.phone ?? null } : null,
  };
  if (!access.financial) return { ...base, financial: null };

  const today = todayBR(now);
  const [accounts, payments, plans, block, lodge, dues] = await Promise.all([
    db.account.findMany({
      where: { lodgeId, memberId, chartAccount: { is: { isSolidarity: false } } },
      select: { id: true, title: true, type: true, amount: true, dueDate: true, status: true, payments: { select: { amount: true } } },
      orderBy: { dueDate: 'asc' },
    }),
    db.payment.findMany({
      where: { lodgeId, OR: [{ memberId }, { account: { memberId } }], account: { chartAccount: { is: { isSolidarity: false } } } },
      select: { id: true, amount: true, paidAt: true, method: true, account: { select: { title: true } } },
      orderBy: { paidAt: 'desc' },
      take: 5,
    }),
    db.degreeFeePlan.findMany({ where: { lodgeId, memberId, status: 'active' }, include: PLAN_INCLUDE, orderBy: { createdAt: 'desc' } }),
    db.memberBlock.findFirst({ where: { lodgeId, memberId, status: { in: ['open', 'settled'] } }, select: { id: true, status: true } }),
    db.lodge.findUnique({ where: { id: lodgeId }, select: { art002Enabled: true } }),
    getMemberDuesStatus(db, lodgeId, memberId, now),
  ]);

  const financial = buildFinancial(accounts.map((a) => ({ ...a, amount: Number(a.amount) })), today);
  return {
    ...base,
    financial: {
      ...financial,
      payments: payments.map((p) => ({ id: p.id, title: p.account.title, amount: Number(p.amount), paidAt: p.paidAt.toISOString(), method: p.method })),
      plans: plans.map((p) => {
        const v = presentPlan(p, now);
        return { id: v.id, label: v.label, totalAmount: v.totalAmount, downPayment: v.downPayment, installments: v.installments, cotaCount: v.cotaCount, paid: v.summary.paid, open: v.summary.open, situation: v.summary.situation };
      }),
      block: block ? { id: block.id, status: block.status } : null,
      art002: isArt002Enabled(lodge) && dues && dues.daysOverdue > ART_002_THRESHOLD_DAYS ? { daysOverdue: dues.daysOverdue, amount: dues.amount } : null,
    },
  };
}
