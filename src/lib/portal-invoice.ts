import { nextInvoiceNumbers } from '@/lib/charges';
import { lockKey } from '@/lib/locks';
import { withTenant } from '@/lib/prisma';

export const CLOSED_INVOICE_STATUSES = ['paid', 'cancelled', 'canceled'];

/**
 * A cobrança (Invoice) em aberto da conta — ou uma nova, pelo saldo, quando a conta não tem
 * (lançamento avulso, venda de material…): o Asaas trabalha com Invoice. Trava por conta:
 * dois cliques seguidos não criam duas cobranças.
 */
export async function ensureOpenInvoice(
  lodgeId: string,
  account: { id: string; title: string; dueDate: Date },
  memberId: string,
  balance: number,
): Promise<string> {
  return withTenant(lodgeId, async (db) => {
    await lockKey(db, `portal-pay:${account.id}`);
    const open = await db.invoice.findFirst({
      where: { accountId: account.id, status: { notIn: CLOSED_INVOICE_STATUSES } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (open) return open.id;
    const [number] = await nextInvoiceNumbers(db, lodgeId, 1);
    const created = await db.invoice.create({
      data: { lodgeId, accountId: account.id, memberId, number, amount: balance, dueDate: account.dueDate, description: account.title },
      select: { id: true },
    });
    return created.id;
  });
}
