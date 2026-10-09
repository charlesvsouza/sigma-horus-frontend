// Edição de um pagamento já lançado (valor, data, conta bancária/caixa, observação) — a peça que faltava:
// o extrato e os saldos leem o PAGAMENTO, então corrigir só o lançamento (Account) deixava os dois
// divergentes. Tudo que muda o caixa passa por aqui: recalcula a situação da conta e das cobranças,
// refaz a assinatura do recibo, reabre a conciliação bancária que apontava para o valor antigo e
// respeita as travas (veneralato encerrado e livro conferido com o banco).
import type { Prisma } from '@/generated/prisma/client';
import { dayKeyToDate, isDayKey, ledgerDayKey } from '@/lib/ledger-day';
import { checkLedgerOpen } from '@/lib/ledger-lock-server';
import { lockKey } from '@/lib/locks';
import { coversAmount, isValidMoney, round2 } from '@/lib/money';
import { findClosedTermForDate } from '@/lib/term-lock';
import { isPlainAccount, syncPlainAccountStatus } from '@/lib/account-status';
import { syncMemberBlock } from '@/lib/member-block-sync';
import { mainPaymentIdFromMarker } from '@/lib/late-charge';
import { autoSignReceipt } from '@/lib/receipt-signature-server';
import { brl } from '@/lib/currency';
import { type SettlementType } from '@/lib/settlement-type';

type Db = Prisma.TransactionClient;

/** Pagamentos que NÃO se editam à mão: nascem de outro fluxo (Asaas, doação/Tronco, custeio) e têm registro irmão. */
const NOT_EDITABLE_METHODS: Record<string, string> = {
  asaas: 'Baixa automática do Asaas: o valor vem do Asaas. Se estiver errada, estorne a baixa e lance de novo.',
  'asaas-cash': 'Recebimento em dinheiro marcado no Asaas: confirme a conta em "Recebidos em dinheiro no Asaas". Se estiver errado, estorne.',
  'asaas-fee': 'Tarifa do Asaas: vem do Asaas e não se edita.',
  'asaas-refund': 'Estorno do Asaas: vem do Asaas e não se edita.',
  donation: 'Aporte/doação do Tronco ou de campanha: o valor está registrado também no fundo. Estorne e lance de novo pela tela de Fundos.',
  fund: 'Custeio de campanha pelo Tronco: o valor está registrado também na campanha. Estorne e lance de novo.',
};

export interface PaymentPatch {
  amount?: number;
  paidAt?: string; // AAAA-MM-DD
  bankAccountId?: string;
  note?: string | null;
  settlementType?: SettlementType;
}

export type EditPaymentResult =
  | { ok: true; changed: string[]; unmatchedBankLines: number }
  | { ok: false; status: number; error: string; code?: string };

export async function editPayment(
  db: Db,
  p: { lodgeId: string; paymentId: string; patch: PaymentPatch; user: { id: string }; /** Valor da conta que vale para a conferência (a edição da conta ainda não foi gravada). */ accountAmount?: number; now?: Date },
): Promise<EditPaymentResult> {
  const { lodgeId, paymentId, patch, user } = p;
  const payment = await db.payment.findFirst({ where: { id: paymentId, lodgeId }, include: { account: true } });
  if (!payment) return { ok: false, status: 404, error: 'Pagamento não encontrado.' };
  await lockKey(db, `account:${payment.accountId}`);

  const blocked = NOT_EDITABLE_METHODS[payment.method];
  if (blocked) return { ok: false, status: 409, error: blocked };
  if (mainPaymentIdFromMarker(payment.account.description)) {
    return { ok: false, status: 409, error: 'Multa e juros lançados junto com uma baixa: estorne a baixa principal (leva o acréscimo junto) e lance de novo.' };
  }

  const next = {
    amount: patch.amount !== undefined ? round2(Number(patch.amount)) : Number(payment.amount),
    paidAt: payment.paidAt,
    bankAccountId: payment.bankAccountId,
    note: patch.note !== undefined ? (patch.note?.trim() || null) : payment.note,
  };
  if (patch.amount !== undefined && !isValidMoney(next.amount)) return { ok: false, status: 400, error: 'Informe um valor maior que zero, com até 2 casas decimais.' };
  if (patch.paidAt !== undefined) {
    if (!isDayKey(patch.paidAt)) return { ok: false, status: 400, error: 'Data inválida. Informe uma data real no formato AAAA-MM-DD.' };
    // Só toca na data se o DIA mudou (um pagamento antigo guardado com horário não é reescrito sem necessidade).
    if (ledgerDayKey(payment.paidAt) !== patch.paidAt) next.paidAt = dayKeyToDate(patch.paidAt);
  }
  if (patch.bankAccountId !== undefined && patch.bankAccountId !== payment.bankAccountId) {
    const bank = await db.financialAccount.findFirst({ where: { id: patch.bankAccountId, lodgeId, active: true }, select: { id: true } });
    if (!bank) return { ok: false, status: 400, error: 'Conta bancária/caixa inválida ou inativa.' };
    next.bankAccountId = bank.id;
  }

  const changed: string[] = [];
  if (Math.round(next.amount * 100) !== Math.round(Number(payment.amount) * 100)) changed.push('valor');
  if (next.paidAt.getTime() !== payment.paidAt.getTime()) changed.push('data');
  if (next.bankAccountId !== payment.bankAccountId) changed.push('conta');
  if (next.note !== payment.note) changed.push('observação');
  if (patch.settlementType !== undefined && patch.settlementType !== payment.settlementType) changed.push('tipo de baixa');
  if (changed.length === 0) return { ok: true, changed, unmatchedBankLines: 0 };

  // Travas: tanto a data de hoje do pagamento quanto a nova.
  const dates = [payment.paidAt, next.paidAt];
  for (const d of dates) {
    const term = await findClosedTermForDate(db, lodgeId, d);
    if (term) return { ok: false, status: 409, error: `Período encerrado (${term.title}). Não é possível alterar pagamento dentro de um veneralato já fechado.` };
  }
  // Observação sozinha não mexe no caixa: não precisa da retificação.
  const cashChanged = changed.some((c) => c !== 'observação' && c !== 'tipo de baixa');
  if (cashChanged) {
    const ledger = await checkLedgerOpen(db, lodgeId, dates, { userId: user.id, what: 'payment.edit' });
    if (!ledger.ok) return { ok: false, status: 409, error: ledger.error, code: 'LEDGER_LOCKED' };
  }

  const account = payment.account;
  // Não deixa o total pago passar do valor da conta (conta de um irmão ou simples; conta compartilhada tem regra própria).
  if (changed.includes('valor') && (account.memberId || (await isPlainAccount(db, account)))) {
    const others = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId: account.id, id: { not: payment.id } } });
    const total = round2(Number(others._sum.amount ?? 0) + next.amount);
    const accountAmount = p.accountAmount ?? Number(account.amount);
    if (Math.round(total * 100) > Math.round(accountAmount * 100)) {
      return { ok: false, status: 400, error: `O total pago (${brl(total)}) passaria do valor da conta (${brl(accountAmount)}). Corrija primeiro o valor da conta em Contas.` };
    }
  }

  await db.payment.update({ where: { id: payment.id }, data: { amount: next.amount, paidAt: next.paidAt, bankAccountId: next.bankAccountId, note: next.note, ...(patch.settlementType !== undefined ? { settlementType: patch.settlementType } : {}) } });

  // A conciliação bancária apontava para o valor/data/conta antigos: reabre a linha do extrato para conferir de novo.
  let unmatchedBankLines = 0;
  if (cashChanged) {
    const r = await db.bankTransaction.updateMany({ where: { matchedPaymentId: payment.id }, data: { status: 'unmatched', matchedPaymentId: null } });
    unmatchedBankLines = r.count;
  }

  // O recibo assinado descrevia o valor/data antigos: refaz a assinatura se havia uma.
  if (cashChanged) {
    const signed = await db.paymentReceiptSignature.findUnique({ where: { paymentId: payment.id }, select: { id: true } });
    if (signed) {
      await db.paymentReceiptSignature.delete({ where: { id: signed.id } });
      await autoSignReceipt(db, lodgeId, payment.id, user.id);
    }
  }

  if (changed.includes('valor')) await resyncAccountAfterPaymentChange(db, lodgeId, payment.accountId, payment.memberId);

  return { ok: true, changed, unmatchedBankLines };
}

/** Recalcula a situação (pendente/paga) da conta e das cobranças depois que um pagamento mudou de valor. */
export async function resyncAccountAfterPaymentChange(db: Db, lodgeId: string, accountId: string, paymentMemberId: string | null): Promise<void> {
  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) return;
  if (account.memberId) {
    const agg = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId } });
    const nextStatus = coversAmount(Number(agg._sum.amount ?? 0), Number(account.amount)) ? 'paid' : 'pending';
    if (nextStatus !== account.status) await db.account.update({ where: { id: accountId }, data: { status: nextStatus } });
    if (nextStatus === 'paid') await db.invoice.updateMany({ where: { accountId, status: { not: 'paid' } }, data: { status: 'paid' } });
    else await db.invoice.updateMany({ where: { accountId, status: 'paid' }, data: { status: 'pending' } });
    await syncMemberBlock(db, lodgeId, account.memberId);
  } else if (await isPlainAccount(db, account)) {
    await syncPlainAccountStatus(db, { id: account.id, amount: Number(account.amount), status: account.status });
    if (paymentMemberId) await syncMemberBlock(db, lodgeId, paymentMemberId);
  } else if (paymentMemberId) {
    const invoices = await db.invoice.findMany({ where: { accountId, memberId: paymentMemberId } });
    const owed = invoices.reduce((s, i) => s + Number(i.amount), 0);
    const paid = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId, memberId: paymentMemberId } });
    const covered = owed > 0 && coversAmount(Number(paid._sum.amount ?? 0), owed);
    await db.invoice.updateMany({ where: { accountId, memberId: paymentMemberId, status: covered ? { not: 'paid' } : 'paid' }, data: { status: covered ? 'paid' : 'pending' } });
    await syncMemberBlock(db, lodgeId, paymentMemberId);
  }
}
