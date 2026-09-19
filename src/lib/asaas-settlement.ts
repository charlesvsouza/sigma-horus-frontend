import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { ASAAS_FEE_CHART, feeFromNet } from '@/lib/collection';
import { coversAmount } from '@/lib/money';
import { syncMemberArt002Status } from '@/lib/overdue';
import { lockKey } from '@/lib/locks';

/**
 * Baixa automática de uma cobrança paga no Asaas: cria o Payment, marca a
 * Invoice e a Account como pagas (se o total já cobrir o valor) e ressincroniza
 * o Art. 002 do membro. Compartilhado pelo webhook (tempo real) e pela
 * reconciliação manual (Financeiro → Integrações → Verificar no Asaas), que
 * cobre o caso do webhook ter falhado/não chegado.
 *
 * O dinheiro é lançado na CONTA CORRENTE da loja (conta de repasse configurada em
 * Modo Asaas) — nunca numa "conta Asaas" — e a tarifa real que o Asaas cobrou
 * (valor − líquido) entra como despesa na mesma conta, para o saldo do sistema
 * bater com o do banco. A loja absorve a tarifa (política atual).
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
    /** Valor líquido informado pelo Asaas (após a tarifa). Sem ele, a tarifa não é lançada. */
    netValue?: number | null;
    /** Método efetivamente pago (PIX, BOLETO, CREDIT_CARD…), informado pelo Asaas. */
    billingType?: string | null;
    /** Evento do Asaas que originou a baixa (webhook) ou "manual-reconcile" (reconciliação sob demanda) — só para o audit log. */
    source?: string;
  },
) {
  const { lodgeId, invoiceId, accountId, memberId, amount, asaasPaymentId, userId, netValue, billingType, source = 'manual-reconcile' } = params;

  // Idempotência: o Asaas reenvia webhooks e a reconciliação manual pode rodar junto. Uma baixa
  // por cobrança do Asaas por vez, e se este pagamento já foi lançado devolve o existente.
  await lockKey(db, `asaas-payment:${asaasPaymentId}`);
  const already = await db.payment.findFirst({ where: { accountId, method: 'asaas', note: { contains: asaasPaymentId } } });
  if (already) return already;

  const [invoice, account, lodge] = await Promise.all([
    db.invoice.findUnique({ where: { id: invoiceId } }),
    db.account.findUnique({ where: { id: accountId } }),
    db.lodge.findUnique({ where: { id: lodgeId }, select: { asaasSettlementAccountId: true } }),
  ]);

  // Sem conta bancária o pagamento não entra no saldo de nenhuma conta: usa a
  // prevista do lançamento (ex.: Caixa do Tronco numa doação por Pix) e, na falta
  // dela, a conta corrente de repasse do Asaas escolhida pela loja.
  const bankAccountId = account?.bankAccountId ?? lodge?.asaasSettlementAccountId ?? null;
  const created = await db.payment.create({
    data: { lodgeId, accountId, memberId, bankAccountId, amount, method: 'asaas', note: `Baixa automática Asaas (${asaasPaymentId})` },
  });

  // Tarifa real cobrada pelo Asaas: despesa na mesma conta, com o rastro na cobrança.
  const fee = feeFromNet(amount, netValue);
  if (invoice) {
    await db.invoice.update({
      where: { id: invoiceId },
      data: { asaasBillingType: billingType ?? null, asaasNetValue: netValue ?? null, asaasFee: fee },
    });
  }
  if (fee != null && fee > 0) {
    const chart =
      (await db.chartAccount.findFirst({ where: { lodgeId, code: ASAAS_FEE_CHART.code }, select: { id: true } })) ??
      (await db.chartAccount.create({ data: { lodgeId, ...ASAAS_FEE_CHART }, select: { id: true } }));
    const feeAccount = await db.account.create({
      data: {
        lodgeId,
        type: 'PAYABLE',
        title: `Tarifa Asaas — cobrança ${invoice?.number ?? invoiceId}`,
        amount: fee,
        dueDate: new Date(),
        status: 'paid',
        chartAccountId: chart.id,
        bankAccountId,
        counterpartyName: 'Asaas',
        description: `Tarifa do Asaas sobre o recebimento ${asaasPaymentId} (absorvida pela loja)`,
      },
    });
    await db.payment.create({
      data: { lodgeId, accountId: feeAccount.id, bankAccountId, amount: fee, method: 'asaas-fee', note: `Tarifa Asaas (${asaasPaymentId})` },
    });
  }

  // Escopa por membro (quando a Invoice tem um): a mesma Account pode ser
  // compartilhada por várias Invoices de membros diferentes (cobrança em
  // massa) — somar todos os pagamentos da accountId inteira quitaria por
  // engano a cobrança dos outros membros. Só marca "paga" quando o valor
  // pago cobrir o valor da PRÓPRIA Invoice (não paga parcial como se fosse cheio).
  if (invoice) {
    const paidWhere = memberId ? { accountId, memberId } : { accountId };
    const aggregate = await db.payment.aggregate({ _sum: { amount: true }, where: paidWhere });
    const totalPaidForInvoice = Number(aggregate._sum.amount ?? 0);
    if (coversAmount(totalPaidForInvoice, Number(invoice.amount))) {
      await db.invoice.update({ where: { id: invoiceId }, data: { status: 'paid' } });
    }
  }

  // Account.status só faz sentido quando a conta é de UM membro — pra conta
  // compartilhada (categoria da cobrança em massa), o status fica intocado.
  if (account?.memberId) {
    const aggregate = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId } });
    const totalPaid = Number(aggregate._sum.amount ?? 0);
    await db.account.update({ where: { id: account.id }, data: { status: coversAmount(totalPaid, Number(account.amount)) ? 'paid' : 'pending' } });
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
    metadata: { source: 'asaas', event: source, asaasPaymentId, invoiceId, amount, fee, billingType: billingType ?? null },
  });

  return created;
}
