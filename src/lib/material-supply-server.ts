import type { Prisma } from '@/generated/prisma/client';
import { round2 } from '@/lib/money';
import { findClosedTermForDate } from '@/lib/term-lock';
import { SALE_CHART_CODE } from '@/lib/material-supply';

/**
 * Venda de material ao obreiro: lança a conta a receber na Tesouraria (categoria
 * 1.2.04 Venda de Materiais e Paramentos, pendente). O Tesoureiro cobra e dá baixa
 * como qualquer conta — nenhum dinheiro se move aqui.
 */
export async function createSaleReceivable(
  db: Prisma.TransactionClient,
  args: { lodgeId: string; memberId: string; materialName: string; quantity: number; unitPrice: number; dueDate: Date },
): Promise<{ accountId: string } | { locked: { title: string } }> {
  const locked = await findClosedTermForDate(db, args.lodgeId, args.dueDate);
  if (locked) return { locked };

  const chart = await db.chartAccount.findFirst({ where: { lodgeId: args.lodgeId, code: SALE_CHART_CODE }, select: { id: true } });
  const account = await db.account.create({
    data: {
      lodgeId: args.lodgeId,
      memberId: args.memberId,
      chartAccountId: chart?.id ?? null,
      type: 'RECEIVABLE',
      title: `Venda: ${args.materialName}${args.quantity > 1 ? ` (${args.quantity} un.)` : ''}`,
      amount: round2(args.unitPrice * args.quantity),
      dueDate: args.dueDate,
      status: 'pending',
      description: 'Lançada automaticamente pelo fornecimento de materiais (venda ao obreiro).',
    },
    select: { id: true },
  });
  return { accountId: account.id };
}

/**
 * Desfazer uma venda apaga a conta a receber — só se ela ainda não teve pagamento
 * nem cobrança emitida (aí o estorno é pela Tesouraria).
 */
export async function removeSaleReceivable(db: Prisma.TransactionClient, accountId: string): Promise<{ ok: true } | { blocked: true }> {
  const acc = await db.account.findUnique({
    where: { id: accountId },
    select: { _count: { select: { payments: true, invoices: true } } },
  });
  if (!acc) return { ok: true };
  if (acc._count.payments > 0 || acc._count.invoices > 0) return { blocked: true };
  await db.account.delete({ where: { id: accountId } });
  return { ok: true };
}
