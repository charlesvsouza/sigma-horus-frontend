// Edição de um lançamento (Account) que já tem pagamento: o extrato e os saldos leem o PAGAMENTO, então
// valor, conta bancária e data corrigidos no lançamento precisam chegar ao pagamento na mesma transação.
import type { Prisma } from '@/generated/prisma/client';
import { ledgerDayKey } from '@/lib/ledger-day';
import { coversAmount, sumMoney } from '@/lib/money';
import { editPayment, type PaymentPatch } from '@/lib/payment-edit-server';

type Db = Prisma.TransactionClient;

export type AccountEditSync =
  | { ok: true; edits: { paymentId: string; before: { amount: number; paidAt: Date }; patch: PaymentPatch; changed: string[]; reopenedBankLines: number }[] }
  | { ok: false; reason: 'multi-payments'; count: number }
  | { ok: false; reason: 'below-paid'; totalPaid: number }
  | { ok: false; reason: 'payment-edit'; status: number; message: string; code?: string };

export async function syncPaymentsOnAccountEdit(
  db: Db,
  p: {
    lodgeId: string;
    userId: string;
    accountId: string;
    existing: { amount: number; bankAccountId: string | null };
    next: { amount: number; amountGiven: boolean; bankAccountId: string | null; bankGiven: boolean; paidAt: string | null };
  },
): Promise<AccountEditSync> {
  const payments = await db.payment.findMany({ where: { accountId: p.accountId }, select: { id: true, amount: true, paidAt: true } });
  if (payments.length === 0) return { ok: true, edits: [] };

  const totalPaid = sumMoney(payments.map((x) => Number(x.amount)));
  const amountChanged = p.next.amountGiven && Math.round(p.next.amount * 100) !== Math.round(p.existing.amount * 100);
  const bankChanged = p.next.bankGiven && p.next.bankAccountId !== null && p.next.bankAccountId !== p.existing.bankAccountId;
  const dateChanged = Boolean(p.next.paidAt) && payments.length === 1 && ledgerDayKey(payments[0].paidAt) !== p.next.paidAt;
  if (!amountChanged && !bankChanged && !dateChanged) return { ok: true, edits: [] };

  const fullyPaid = coversAmount(totalPaid, p.existing.amount);
  if (payments.length > 1 && (bankChanged || dateChanged || (amountChanged && fullyPaid))) return { ok: false, reason: 'multi-payments', count: payments.length };
  if (amountChanged && !fullyPaid && Math.round(p.next.amount * 100) < Math.round(totalPaid * 100)) return { ok: false, reason: 'below-paid', totalPaid };
  if (payments.length !== 1) return { ok: true, edits: [] };

  const patch: PaymentPatch = {};
  if (amountChanged && fullyPaid) patch.amount = p.next.amount;
  if (bankChanged && p.next.bankAccountId) patch.bankAccountId = p.next.bankAccountId;
  if (dateChanged && p.next.paidAt) patch.paidAt = p.next.paidAt;
  if (Object.keys(patch).length === 0) return { ok: true, edits: [] };

  const before = payments[0];
  const r = await editPayment(db, { lodgeId: p.lodgeId, paymentId: before.id, patch, user: { id: p.userId }, accountAmount: p.next.amount });
  if (!r.ok) return { ok: false, reason: 'payment-edit', status: r.status, message: r.error, code: r.code };
  return { ok: true, edits: [{ paymentId: before.id, before: { amount: Number(before.amount), paidAt: before.paidAt }, patch, changed: r.changed, reopenedBankLines: r.unmatchedBankLines }] };
}
