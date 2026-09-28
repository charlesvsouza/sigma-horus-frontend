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

export interface PortalSummary {
  /** Saldo em aberto do que o irmão deve à loja. */
  totalReceivables: number;
  /** Saldo em aberto do que a loja deve ao irmão. */
  totalPayables: number;
  /** Parte do "o que devo" já vencida. */
  overdue: number;
}

/**
 * Resumo financeiro do portal: só o que está EM ABERTO (saldo, descontados parciais).
 * Conta paga não entra — senão "O que devo" continuava mostrando a mensalidade já baixada.
 */
export function portalSummary(items: { type: string; balance: number; effectiveStatus: EffectiveStatus }[]): PortalSummary {
  const sum = (list: { balance: number }[]) => sumMoney(list.map((i) => i.balance));
  const receivable = items.filter((i) => i.type === 'RECEIVABLE');
  return {
    totalReceivables: sum(receivable),
    totalPayables: sum(items.filter((i) => i.type === 'PAYABLE')),
    overdue: sum(receivable.filter((i) => i.effectiveStatus === 'overdue')),
  };
}

/** Recusa de escrita no portal (matriz da loja): diz o que fazer, em vez de só "Acesso negado". */
export const PORTAL_WRITE_DENIED =
  'Sua loja não liberou para o seu cargo pagar pelo portal. Peça ao Administrador: Configurações → Permissões → "Portal do irmão", coluna Editar.';

/** Entidade do AuditLog que guarda o "Já paguei" do irmão (Modo Loja). */
export const PAYMENT_NOTICE_ENTITY = 'member-payment-notice';

/** Intervalo mínimo entre dois avisos "Já paguei" da mesma conta. */
export const PAYMENT_NOTICE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
