import type { Prisma } from '@/generated/prisma/client';

type Db = Prisma.TransactionClient;

/**
 * Cobranças que compartilham uma cobrança do Asaas que vai ser cancelada (reemissão de uma
 * delas, renegociação): as OUTRAS deixam de ter Pix válido — voltam a "pendente" e sem
 * vínculo, para o irmão (ou a Tesouraria) gerar um novo. Sem isto ficariam apontando para
 * uma cobrança apagada no Asaas.
 */
export async function detachGroupSiblings(db: Db, lodgeId: string, asaasPaymentIds: string[], exceptInvoiceIds: string[] = []): Promise<number> {
  if (asaasPaymentIds.length === 0) return 0;
  const r = await db.invoice.updateMany({
    where: { lodgeId, asaasPaymentId: { in: asaasPaymentIds }, status: { not: 'paid' }, id: { notIn: exceptInvoiceIds } },
    data: { status: 'pending', asaasPaymentId: null, asaasInvoiceUrl: null },
  });
  return r.count;
}
