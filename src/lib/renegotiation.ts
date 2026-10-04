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
  const ids = linked.map((i) => i.asaasPaymentId).filter((id): id is string => Boolean(id));
  // Pix agrupado: as outras contas do grupo também perdem o Pix (ele vai ser cancelado no Asaas).
  if (ids.length > 0) {
    await db.invoice.updateMany({
      where: { asaasPaymentId: { in: ids }, status: { not: 'paid' } },
      data: { status: 'pending', asaasPaymentId: null, asaasInvoiceUrl: null },
    });
  }
  return ids;
}

/**
 * Acordo (quitação/regularização): as dívidas passam a ser cobradas SÓ pelas parcelas do acordo, no Pix da
 * loja. As cobranças abertas dessas contas no Asaas perdem o vínculo (voltam a "pendente", valor e vencimento
 * intactos) e devolve os ids do Asaas a cancelar depois do commit — assim ninguém paga o valor antigo em duplicidade.
 */
export async function releaseAsaasCharges(db: Prisma.TransactionClient, accountIds: string[]): Promise<string[]> {
  if (accountIds.length === 0) return [];
  const linked = await db.invoice.findMany({ where: { accountId: { in: accountIds }, status: { not: 'paid' }, asaasPaymentId: { not: null } }, select: { asaasPaymentId: true } });
  const ids = [...new Set(linked.map((i) => i.asaasPaymentId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return [];
  // Inclui as irmãs de Pix agrupado: o grupo inteiro perde o Pix (vai ser cancelado no Asaas).
  await db.invoice.updateMany({ where: { asaasPaymentId: { in: ids }, status: { not: 'paid' } }, data: { status: 'pending', asaasPaymentId: null, asaasInvoiceUrl: null } });
  return ids;
}
