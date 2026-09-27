import { daysOverdueBR } from '@/lib/date-only';
import { remainingAmount, sumMoney } from '@/lib/money';

// "Minhas pendências" do portal do irmão. A conta (Account) só guarda pending|paid;
// o vencido é derivado do vencimento no calendário de Brasília (vence hoje = em dia).

export type EffectiveStatus = 'paid' | 'overdue' | 'pending';

export interface PortalAccountLike {
  type: string;
  status: string;
  amount: number;
  dueDate: Date | string;
  memberId?: string | null;
  approvalStatus?: string | null;
}

export function effectiveStatus(account: Pick<PortalAccountLike, 'status' | 'dueDate'>, now: Date = new Date()): EffectiveStatus {
  if (account.status === 'paid') return 'paid';
  return daysOverdueBR(account.dueDate, now) > 0 ? 'overdue' : 'pending';
}

/** Quanto falta pagar da conta (desconta pagamentos parciais). */
export function openBalance(account: Pick<PortalAccountLike, 'amount' | 'status'>, payments: { amount: number }[]): number {
  if (account.status === 'paid') return 0;
  return remainingAmount(Number(account.amount), sumMoney(payments.map((p) => Number(p.amount))));
}

/**
 * O irmão só paga pelo portal o que ELE deve à loja: conta a receber, dele, aprovada e
 * com saldo em aberto. "A Loja me deve" (irmão fornecedor) fica só no extrato.
 */
export function canPay(account: PortalAccountLike, memberId: string, balance: number): boolean {
  return (
    account.type === 'RECEIVABLE' &&
    account.memberId === memberId &&
    (account.approvalStatus ?? 'approved') === 'approved' &&
    account.status !== 'paid' &&
    balance > 0
  );
}

/** Entidade do AuditLog que guarda o "Já paguei" do irmão (Modo Loja). */
export const PAYMENT_NOTICE_ENTITY = 'member-payment-notice';

/** Intervalo mínimo entre dois avisos "Já paguei" da mesma conta. */
export const PAYMENT_NOTICE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
