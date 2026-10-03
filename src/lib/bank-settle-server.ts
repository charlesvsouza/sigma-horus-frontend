import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { isPlainAccount, syncPlainAccountStatus } from '@/lib/account-status';
import { findOpenAsaasCharges } from '@/lib/asaas-manual';
import { dateOnlyUTC } from '@/lib/date-only';
import { lockKey } from '@/lib/locks';
import { syncMemberBlock } from '@/lib/member-block-sync';
import { coversAmount, remainingAmount, round2 } from '@/lib/money';
import { suggestAccounts, type Suggestion } from '@/lib/bank-suggest';
import { withTenant } from '@/lib/prisma';
import { findClosedTermForDate } from '@/lib/term-lock';

type Db = Prisma.TransactionClient;

/** Cobranças em aberto (a receber, de um irmão) com o saldo já descontados os pagamentos. */
async function openReceivables(db: Db, lodgeId: string) {
  const rows = await db.account.findMany({
    where: { lodgeId, type: 'RECEIVABLE', status: { not: 'paid' }, approvalStatus: 'approved', memberId: { not: null } },
    select: { id: true, title: true, amount: true, dueDate: true, member: { select: { name: true } }, payments: { select: { amount: true } } },
    orderBy: { dueDate: 'asc' },
  });
  return rows
    .map((a) => ({
      accountId: a.id,
      title: a.title,
      memberName: a.member?.name ?? null,
      balance: remainingAmount(Number(a.amount), a.payments.reduce((s, p) => s + Number(p.amount), 0)),
      dueDate: a.dueDate,
    }))
    .filter((a) => a.balance > 0);
}

export interface BankSuggestionsResult {
  line: { id: string; date: string; description: string; amount: number; status: string };
  suggestions: (Omit<Suggestion, 'dueDate'> & { dueDate: string })[];
}

/** Sugestões de cobrança para uma linha de crédito do extrato ainda sem vínculo. */
export async function suggestForBankLine(lodgeId: string, bankTxId: string): Promise<BankSuggestionsResult | { error: string; status: number }> {
  return withTenant(lodgeId, async (db) => {
    const tx = await db.bankTransaction.findFirst({ where: { id: bankTxId, lodgeId } });
    if (!tx) return { error: 'Lançamento não encontrado.', status: 404 };
    if (tx.amount <= 0) return { error: 'Só créditos (entradas) podem dar baixa em cobrança.', status: 400 };
    const suggestions = suggestAccounts({ amount: Number(tx.amount), description: tx.description }, await openReceivables(db, lodgeId));
    return {
      line: { id: tx.id, date: tx.date.toISOString(), description: tx.description, amount: Number(tx.amount), status: tx.status },
      suggestions: suggestions.map((s) => ({ ...s, dueDate: s.dueDate.toISOString() })),
    };
  });
}

export type BankSettleResult = { ok: true; paymentId: string } | { ok: false; status: number; error: string };

/**
 * Dá baixa na cobrança escolhida com o valor do crédito do extrato e já concilia a linha. A Tesouraria
 * confere a sugestão antes de confirmar. O valor nunca passa do saldo; pagamento menor que o saldo vira
 * baixa parcial. Cobrança aberta no Asaas é recusada (no Modo Asaas a baixa vem do próprio Asaas).
 */
export async function settleFromBankLine(
  lodgeId: string,
  userId: string,
  input: { bankTxId: string; accountId: string; bankAccountId: string },
): Promise<BankSettleResult> {
  return withTenant(lodgeId, async (db): Promise<BankSettleResult> => {
    await lockKey(db, `bank-line:${input.bankTxId}`);
    await lockKey(db, `account:${input.accountId}`);

    const tx = await db.bankTransaction.findFirst({ where: { id: input.bankTxId, lodgeId } });
    if (!tx) return { ok: false, status: 404, error: 'Lançamento não encontrado.' };
    if (tx.status !== 'unmatched') return { ok: false, status: 409, error: 'Esta linha do extrato já foi conciliada ou ignorada.' };
    if (tx.amount <= 0) return { ok: false, status: 400, error: 'Só créditos (entradas) podem dar baixa em cobrança.' };

    const account = await db.account.findFirst({ where: { id: input.accountId, lodgeId, type: 'RECEIVABLE' } });
    if (!account) return { ok: false, status: 404, error: 'Cobrança não encontrada.' };
    if (account.approvalStatus !== 'approved') return { ok: false, status: 409, error: 'Esta conta não está liberada para baixa.' };

    const bank = await db.financialAccount.findFirst({ where: { id: input.bankAccountId, lodgeId, active: true }, select: { id: true } });
    if (!bank) return { ok: false, status: 400, error: 'Escolha a conta bancária/caixa que recebeu o crédito.' };

    const paidAt = dateOnlyUTC(tx.date);
    const locked = await findClosedTermForDate(db, lodgeId, paidAt);
    if (locked) return { ok: false, status: 409, error: `Período encerrado (${locked.title}): a data do crédito cai num veneralato já fechado.` };

    const open = await findOpenAsaasCharges(db, { accountId: account.id, memberId: account.memberId });
    if (open.length > 0) {
      return { ok: false, status: 409, error: `A cobrança ${open.map((c) => c.number).join(', ')} está aberta no Asaas: nesta loja a baixa vem do próprio Asaas. Cancele-a lá antes, se o valor entrou por fora.` };
    }

    const paidAgg = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId: account.id } });
    const balance = remainingAmount(Number(account.amount), Number(paidAgg._sum.amount ?? 0));
    const amount = round2(Number(tx.amount));
    if (balance <= 0) return { ok: false, status: 409, error: 'Esta cobrança já está quitada.' };
    if (amount > balance + 0.005) return { ok: false, status: 400, error: 'O crédito é maior que o saldo da cobrança: escolha outra ou lance o excedente à parte.' };

    const payment = await db.payment.create({
      data: {
        lodgeId, accountId: account.id, memberId: account.memberId, bankAccountId: bank.id, amount, paidAt,
        method: /pix/i.test(tx.description) ? 'pix' : 'transfer',
        note: `Baixa assistida pelo extrato bancário: "${tx.description.slice(0, 120)}"`,
      },
      select: { id: true },
    });

    // Mesmas regras da baixa manual (api/payments): quita a conta e as cobranças dela, e ressincroniza o bloqueio.
    if (account.memberId) {
      const agg = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId: account.id } });
      const paid = coversAmount(Number(agg._sum.amount ?? 0), Number(account.amount));
      await db.account.update({ where: { id: account.id }, data: { status: paid ? 'paid' : 'pending' } });
      if (paid) await db.invoice.updateMany({ where: { accountId: account.id, status: { not: 'paid' } }, data: { status: 'paid' } });
      await syncMemberBlock(db, lodgeId, account.memberId);
    } else if (await isPlainAccount(db, account)) {
      await syncPlainAccountStatus(db, { id: account.id, amount: Number(account.amount), status: account.status });
    }

    await db.bankTransaction.update({ where: { id: tx.id }, data: { status: 'matched', matchedPaymentId: payment.id } });
    await logAudit(db, {
      lodgeId, userId, action: 'CREATE', entity: 'payment', entityId: payment.id,
      metadata: { source: 'bank-statement', bankTxId: tx.id, accountId: account.id, amount },
    });
    return { ok: true, paymentId: payment.id };
  });
}
