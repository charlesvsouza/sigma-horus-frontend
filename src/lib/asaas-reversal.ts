import type { Prisma } from '@/generated/prisma/client';
import { todayBR } from '@/lib/date-only';
import { lockKey } from '@/lib/locks';
import { coversAmount } from '@/lib/money';
import { syncMemberBlock } from '@/lib/member-block-sync';

type Db = Prisma.TransactionClient;

/** Eventos do Asaas em que o dinheiro JÁ recebido volta ao pagador. */
export const MONEY_BACK_EVENTS = new Set(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED']);

export interface ReversalResult {
  /** Lançamentos de estorno criados (0 = nada a estornar ou já estornado). */
  reversed: number;
  total: number;
  invoiceNumbers: string[];
  memberIds: string[];
}

/**
 * Estorno de um recebimento do Asaas devolvido ao pagador (reembolso ou chargeback). Para cada baixa
 * automática dessa cobrança lança um Payment NEGATIVO na mesma conta (método `asaas-refund`): o saldo
 * da conta bancária cai, a receita do período se anula e a conta volta a ficar em aberto — tudo pelas
 * mesmas somas que o resto do sistema já usa. A baixa original é mantida (o recebimento aconteceu).
 * A tarifa cobrada pelo Asaas fica como despesa (o Asaas normalmente não a devolve).
 * Idempotente por baixa original: o Asaas reenvia webhooks. A auditoria fica com quem chama (webhook).
 */
export async function reverseAsaasPayment(
  db: Db,
  params: { lodgeId: string; asaasPaymentId: string; event: string; userId: string },
): Promise<ReversalResult> {
  const { lodgeId, asaasPaymentId, event } = params;
  await lockKey(db, `asaas-reversal:${asaasPaymentId}`);

  const invoices = await db.invoice.findMany({
    where: { lodgeId, asaasPaymentId },
    select: { id: true, number: true, accountId: true, memberId: true, amount: true },
  });
  const result: ReversalResult = { reversed: 0, total: 0, invoiceNumbers: [], memberIds: [] };
  const today = todayBR();

  for (const inv of invoices) {
    const originals = await db.payment.findMany({
      where: { lodgeId, accountId: inv.accountId, method: 'asaas', note: { contains: asaasPaymentId }, ...(inv.memberId ? { OR: [{ memberId: inv.memberId }, { memberId: null }] } : {}) },
      select: { id: true, amount: true, memberId: true, bankAccountId: true },
    });
    let reversedHere = 0;
    for (const p of originals) {
      const marker = `baixa ${p.id}`;
      const done = await db.payment.findFirst({ where: { lodgeId, accountId: inv.accountId, method: 'asaas-refund', note: { contains: marker } }, select: { id: true } });
      if (done) continue;
      await db.payment.create({
        data: {
          lodgeId, accountId: inv.accountId, memberId: p.memberId, bankAccountId: p.bankAccountId,
          amount: -Number(p.amount), method: 'asaas-refund', paidAt: today,
          note: `Estorno Asaas (${asaasPaymentId}) — ${marker} — ${event === 'PAYMENT_REFUNDED' ? 'reembolso' : 'chargeback'}`,
        },
      });
      result.reversed++;
      result.total += Number(p.amount);
      reversedHere++;
    }
    if (reversedHere === 0) continue;

    // A cobrança e a conta voltam a "em aberto" se o que sobrou pago não cobre mais o valor.
    const mine = await db.payment.aggregate({ _sum: { amount: true }, where: inv.memberId ? { accountId: inv.accountId, memberId: inv.memberId } : { accountId: inv.accountId } });
    if (!coversAmount(Number(mine._sum.amount ?? 0), Number(inv.amount))) {
      await db.invoice.update({ where: { id: inv.id }, data: { status: 'pending' } });
    }
    const account = await db.account.findUnique({ where: { id: inv.accountId }, select: { id: true, memberId: true, amount: true } });
    if (account?.memberId) {
      const all = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId: account.id } });
      if (!coversAmount(Number(all._sum.amount ?? 0), Number(account.amount))) {
        await db.account.update({ where: { id: account.id }, data: { status: 'pending' } });
      }
    }
    result.invoiceNumbers.push(inv.number);
    if (inv.memberId) result.memberIds.push(inv.memberId);
  }

  for (const memberId of new Set(result.memberIds)) await syncMemberBlock(db, lodgeId, memberId);
  return result;
}
