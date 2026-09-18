import type { Prisma } from '@/generated/prisma/client';

/**
 * Renegociação: as cobranças (Invoice) ainda não pagas de um lançamento passam a
 * seguir o novo valor e vencimento. O Art. 002 conta pela cobrança quando ela
 * existe, então sem isto o irmão continuaria enquadrado com o vencimento antigo.
 * Cobrança já emitida no Asaas perde o vínculo (valor/data antigos) e volta a
 * "pendente" para ser reemitida; devolve os ids do Asaas a cancelar depois do commit.
 */
export async function retargetInvoices(
  db: Prisma.TransactionClient,
  accountId: string,
  next: { amount: number; dueDate: Date },
): Promise<string[]> {
  const open = { accountId, status: { not: 'paid' } } as const;
  const linked = await db.invoice.findMany({ where: open, select: { asaasPaymentId: true } });
  await db.invoice.updateMany({
    where: open,
    data: { amount: next.amount, dueDate: next.dueDate, status: 'pending', asaasPaymentId: null, asaasInvoiceUrl: null },
  });
  return linked.map((i) => i.asaasPaymentId).filter((id): id is string => Boolean(id));
}
