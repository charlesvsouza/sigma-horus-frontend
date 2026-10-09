import type { Prisma } from '@/generated/prisma/client';
import type { PaymentHistoryInput } from '@/lib/payment-history';
import { settlementLabel } from '@/lib/settlement-type';

/**
 * Pagamentos dos irmãos à loja (contas a receber). O irmão do pagamento é o do Payment ou,
 * na falta, o dono da conta: baixa manual antiga pode ter sido registrada sem "vincular a um
 * membro" e sumiria do histórico dele. Contraparte que não é irmão (cliente/fornecedor) não entra.
 */
export async function loadPaymentHistory(db: Prisma.TransactionClient, lodgeId: string, memberId?: string | null): Promise<PaymentHistoryInput[]> {
  const payments = await db.payment.findMany({
    where: {
      lodgeId,
      account: { type: 'RECEIVABLE' },
      OR: memberId
        ? [{ memberId }, { memberId: null, account: { memberId } }]
        : [{ memberId: { not: null } }, { account: { memberId: { not: null } } }],
    },
    select: {
      id: true, paidAt: true, method: true, amount: true, settlementType: true, note: true,
      bankTransactions: { select: { id: true }, take: 1 },
      member: { select: { id: true, name: true } },
      account: {
        select: {
          title: true, dueDate: true,
          member: { select: { id: true, name: true } },
          chartAccount: { select: { name: true } },
        },
      },
    },
    orderBy: { paidAt: 'asc' },
  });

  return payments.map((p) => {
    const member = p.member ?? p.account?.member ?? null;
    return {
      id: p.id,
      paidAt: p.paidAt,
      memberId: member?.id ?? null,
      memberName: member?.name ?? null,
      title: p.account?.title ?? 'Pagamento',
      category: p.account?.chartAccount?.name ?? null,
      dueDate: p.account?.dueDate ?? null,
      method: p.method,
      settlement: settlementLabel({ settlementType: p.settlementType, method: p.method, note: p.note, bankMatched: p.bankTransactions.length > 0 }),
      amount: Number(p.amount),
    };
  });
}
