import type { Prisma } from '@/generated/prisma/client';
import { coversAmount, remainingAmount } from '@/lib/money';
import { findClosedTermForDate } from '@/lib/term-lock';

/**
 * "Conta simples": sem membro fixo e sem cobranças (Invoice) — despesa de
 * fornecedor, receita avulsa etc. Seu status depende só da soma dos pagamentos.
 * (Conta de um membro e conta compartilhada de cobrança em massa têm regras
 * próprias em payments/route.ts.)
 */
export async function isPlainAccount(db: Prisma.TransactionClient, account: { id: string; memberId: string | null }) {
  if (account.memberId) return false;
  return (await db.invoice.count({ where: { accountId: account.id } })) === 0;
}

/** Recalcula pending/paid de uma conta simples a partir da soma dos pagamentos. */
export async function syncPlainAccountStatus(db: Prisma.TransactionClient, account: { id: string; amount: number; status: string }) {
  const aggregate = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId: account.id } });
  const totalPaid = Number(aggregate._sum.amount ?? 0);
  const nextStatus = coversAmount(totalPaid, Number(account.amount)) ? 'paid' : 'pending';
  if (nextStatus !== account.status) {
    await db.account.update({ where: { id: account.id }, data: { status: nextStatus } });
  }
}

export type SettleResult = { ok: true; created: boolean } | { ok: false; status: number; error: string };

/**
 * Marcar um lançamento como "Pago" precisa gerar o Payment — é ele que move o
 * caixa (saldo/extrato), o "Recebido", o DRE e o livro-caixa. Cria o pagamento
 * do que ainda falta quitar, na conta bancária/caixa informada.
 */
export async function settleAccountAsPaid(
  db: Prisma.TransactionClient,
  params: {
    lodgeId: string;
    account: { id: string; amount: number; memberId: string | null; type: string; approvalStatus: string };
    bankAccountId: string | null;
    paidAt: Date;
  },
): Promise<SettleResult> {
  const { lodgeId, account, bankAccountId, paidAt } = params;

  const aggregate = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId: account.id } });
  const remaining = remainingAmount(Number(account.amount), Number(aggregate._sum.amount ?? 0));
  if (remaining <= 0) return { ok: true, created: false };

  if (account.type === 'PAYABLE' && account.approvalStatus === 'pending') {
    return { ok: false, status: 409, error: 'Despesa acima do limite precisa do visto do Venerável antes de ser paga. Lance como Pendente e aprove primeiro.' };
  }
  if (!bankAccountId) {
    return { ok: false, status: 400, error: 'Para lançar como Pago, selecione a conta bancária/caixa que recebeu ou pagou este valor.' };
  }
  const bank = await db.financialAccount.findFirst({ where: { id: bankAccountId, lodgeId, active: true }, select: { id: true } });
  if (!bank) return { ok: false, status: 400, error: 'Conta bancária/caixa inválida ou inativa.' };

  const locked = await findClosedTermForDate(db, lodgeId, paidAt);
  if (locked) {
    return { ok: false, status: 409, error: `Período encerrado (${locked.title}). Não é possível registrar pagamento com data dentro de um veneralato já fechado.` };
  }

  await db.payment.create({
    data: {
      lodgeId,
      accountId: account.id,
      memberId: account.memberId,
      bankAccountId: bank.id,
      amount: remaining,
      paidAt,
      method: 'manual',
      note: 'Lançamento registrado como pago',
    },
  });
  return { ok: true, created: true };
}
