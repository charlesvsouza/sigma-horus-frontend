import type { Prisma } from '@/generated/prisma/client';

type Db = Prisma.TransactionClient;

export const AGREEMENT_ITEM_MESSAGE = 'Esta conta faz parte de um acordo em aberto: a cobrança é feita pelas parcelas do acordo (Tesouraria → Acordos), no Pix da loja.';

/**
 * Contas (dívidas) que fazem parte de um acordo EM ABERTO. Elas não são cobradas por outro caminho (Asaas,
 * fila de cobranças, "Pagar" do portal): o irmão paga as parcelas do acordo, e o que ele pagar abate as dívidas.
 */
export async function agreementDebtAccountIds(db: Db, lodgeId: string, memberId?: string): Promise<Set<string>> {
  const rows = await db.memberBlockItem.findMany({
    where: { lodgeId, kind: 'debt', block: { status: 'open', ...(memberId ? { memberId } : {}) } },
    select: { accountId: true },
  });
  return new Set(rows.map((r) => r.accountId));
}
