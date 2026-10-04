// Contagens do "Precisa de atenção" da Visão geral — regras puras.
//
// Account.status e Invoice.status quase nunca viram "overdue" no banco: a conta/cobrança continua "pending" depois do
// vencimento (só o webhook do Asaas marca cobrança como overdue, e só quando existe cobrança no Asaas). Contar pelo
// status gravado fazia "Contas vencidas" mostrar 0 mesmo com mensalidade atrasada. Aqui a conta é vencida quando ainda
// tem saldo em aberto e o vencimento (dia civil de Brasília) já passou — a mesma regra do portal (lib/portal-dues).

const cents = (n: number) => Math.round(n * 100);
const dayOf = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface DashAccount { id: string; amount: number; dueDate: Date; status: string; approvalStatus?: string | null }

/** `today` = dia civil de Brasília (00:00 UTC, como lib/date-only todayBR). Conta rejeitada ou já quitada não conta. */
export function countAccountsByDue(accounts: DashAccount[], paidByAccount: Map<string, number>, today: Date): { overdue: number; pending: number } {
  let overdue = 0, pending = 0;
  for (const a of accounts) {
    if (a.status === 'paid' || a.approvalStatus === 'rejected') continue;
    const open = cents(a.amount) - cents(paidByAccount.get(a.id) ?? 0);
    if (open <= 0) continue;
    if (dayOf(a.dueDate) < today.getTime()) overdue++;
    else pending++;
  }
  return { overdue, pending };
}

const CLOSED = ['paid', 'cancelled', 'canceled'];

/**
 * Cobranças em aberto, separadas em vencidas (venceram antes de hoje) e a vencer/vencendo hoje. Mesmo critério da tela
 * Cobranças: só conta a que ainda tem saldo em aberto (`openBalance`, com pagamento parcial da conta já descontado).
 */
export function countInvoicesByDue(invoices: { status: string; dueDate: Date; openBalance: number }[], today: Date): { overdue: number; pending: number } {
  let overdue = 0, pending = 0;
  for (const i of invoices) {
    if (CLOSED.includes(i.status) || !(i.openBalance > 0)) continue;
    if (dayOf(i.dueDate) < today.getTime()) overdue++;
    else pending++;
  }
  return { overdue, pending };
}
