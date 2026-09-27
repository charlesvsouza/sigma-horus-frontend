import type { Prisma } from '@/generated/prisma/client';
import { debtBalance, type OpenDebt } from '@/lib/good-standing';

/**
 * O que o irmão deve à loja e ainda está em aberto: contas dele (1:1) e, nas contas
 * COMPARTILHADAS antigas (cobrança em massa, sem membro), a cobrança dele menos o que ele
 * pagou nela. Sem isso, quem só deve por uma conta compartilhada sairia "regular".
 */
export async function loadMemberOpenDebts(db: Prisma.TransactionClient, lodgeId: string, memberId: string): Promise<OpenDebt[]> {
  const [accounts, sharedInvoices] = await Promise.all([
    db.account.findMany({
      where: { lodgeId, memberId, type: 'RECEIVABLE', status: { not: 'paid' }, approvalStatus: 'approved' },
      select: { title: true, amount: true, dueDate: true, payments: { select: { amount: true } } },
    }),
    db.invoice.findMany({
      where: { lodgeId, memberId, status: { notIn: ['paid', 'cancelled', 'canceled'] }, account: { memberId: null, type: 'RECEIVABLE' } },
      select: { amount: true, dueDate: true, account: { select: { title: true, payments: { where: { memberId }, select: { amount: true } } } } },
    }),
  ]);
  return [
    ...accounts.map((a) => ({ title: a.title, dueDate: a.dueDate, balance: debtBalance(Number(a.amount), a.payments.map((p) => Number(p.amount))) })),
    ...sharedInvoices.map((i) => ({ title: i.account.title, dueDate: i.dueDate, balance: debtBalance(Number(i.amount), i.account.payments.map((p) => Number(p.amount))) })),
  ];
}
