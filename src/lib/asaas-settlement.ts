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
    /** Evento do Asaas que originou a baixa (webhook) ou "manual-reconcile" (reconciliação sob demanda) — só para o audit log. */
    source?: string;
  },
) {
  const { lodgeId, invoiceId, accountId, memberId, amount, asaasPaymentId, userId, source = 'manual-reconcile' } = params;

  const created = await db.payment.create({
    data: { lodgeId, accountId, memberId, amount, method: 'asaas', note: `Baixa automática Asaas (${asaasPaymentId})` },
  });

  const [invoice, account] = await Promise.all([
    db.invoice.findUnique({ where: { id: invoiceId } }),
    db.account.findUnique({ where: { id: accountId } }),
  ]);

  // Escopa por membro (quando a Invoice tem um): a mesma Account pode ser
  // compartilhada por várias Invoices de membros diferentes (cobrança em
  // massa) — somar todos os pagamentos da accountId inteira quitaria por
  // engano a cobrança dos outros membros. Só marca "paga" quando o valor
  // pago cobrir o valor da PRÓPRIA Invoice (não paga parcial como se fosse cheio).
  if (invoice) {
    const paidWhere = memberId ? { accountId, memberId } : { accountId };
    const aggregate = await db.payment.aggregate({ _sum: { amount: true }, where: paidWhere });
    const totalPaidForInvoice = Number(aggregate._sum.amount ?? 0);
    if (totalPaidForInvoice >= Number(invoice.amount)) {
      await db.invoice.update({ where: { id: invoiceId }, data: { status: 'paid' } });
    }
  }

  // Account.status só faz sentido quando a conta é de UM membro — pra conta
  // compartilhada (categoria da cobrança em massa), o status fica intocado.
  if (account?.memberId) {
    const aggregate = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId } });
    const totalPaid = Number(aggregate._sum.amount ?? 0);
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
    metadata: { source: 'asaas', event: source, asaasPaymentId, invoiceId, amount },
  });

  return created;
}
