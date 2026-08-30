import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { syncMemberArt002Status } from '@/lib/overdue';

/**
 * Baixa automática de uma cobrança paga no Asaas: cria o Payment, marca a
 * Invoice e a Account como pagas (se o total já cobrir o valor) e ressincroniza
 * o Art. 002 do membro. Compartilhado pelo webhook (tempo real) e pela
 * reconciliação manual (Financeiro → Integrações → Verificar no Asaas), que
 * cobre o caso do webhook ter falhado/não chegado.
 */
export async function settleAsaasInvoicePayment(
  db: Prisma.TransactionClient,
  params: {
    lodgeId: string;
    invoiceId: string;
    accountId: string;
    memberId: string | null;
    amount: number;
    asaasPaymentId: string;
    userId: string;
  },
) {
  const { lodgeId, invoiceId, accountId, memberId, amount, asaasPaymentId, userId } = params;

  const created = await db.payment.create({
    data: { lodgeId, accountId, memberId, amount, method: 'asaas', note: `Baixa automática Asaas (${asaasPaymentId})` },
  });

  const account = await db.account.findUnique({ where: { id: accountId } });
  const aggregate = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId } });
  const totalPaid = Number(aggregate._sum.amount ?? 0);

  await db.invoice.update({ where: { id: invoiceId }, data: { status: 'paid' } });
  if (account) {
    await db.account.update({ where: { id: account.id }, data: { status: totalPaid >= Number(account.amount) ? 'paid' : 'pending' } });
  }
  if (memberId) {
    await syncMemberArt002Status(db, lodgeId, memberId);
  }

  await logAudit(db, {
    lodgeId,
    userId,
    action: 'CREATE',
    entity: 'payment',
    entityId: created.id,
    metadata: { source: 'asaas', asaasPaymentId, invoiceId, amount },
  });

  return created;
}
