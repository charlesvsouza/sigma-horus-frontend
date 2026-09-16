// Lógica pura de saldo por conta financeira (banco/investimento/caixa),
// separada da rota para ser testável sem Prisma. Mesmo espírito de
// lib/closing.ts e lib/hospitalaria.ts (saldo = abertura + entradas − saídas).

export interface AccountPaymentInput {
  bankAccountId: string | null;
  amount: number;
  accountType: string; // 'RECEIVABLE' | 'PAYABLE' — do Account ligado ao Payment
}

export interface ApprovedTransferInput {
  fromId: string;
  toId: string;
  amount: number;
}

export interface FinancialAccountBalance {
  id: string;
  saldo: number;
}

/**
 * Saldo de cada FinancialAccount = openingBalance
 *   + pagamentos recebidos (Account RECEIVABLE) − pagamentos de contas a pagar (PAYABLE)
 *   + transferências aprovadas recebidas − transferências aprovadas enviadas.
 * Só transferências com status='approved' entram aqui — pendentes/rejeitadas não afetam saldo.
 */
export function computeFinancialAccountBalances(
  accounts: { id: string; openingBalance: number }[],
  payments: AccountPaymentInput[],
  approvedTransfers: ApprovedTransferInput[],
): FinancialAccountBalance[] {
  const saldos = new Map<string, number>();
  for (const a of accounts) saldos.set(a.id, a.openingBalance);

  for (const p of payments) {
    if (!p.bankAccountId || !saldos.has(p.bankAccountId)) continue;
    const sinal = p.accountType === 'RECEIVABLE' ? 1 : -1;
    saldos.set(p.bankAccountId, (saldos.get(p.bankAccountId) ?? 0) + sinal * p.amount);
  }

  for (const t of approvedTransfers) {
    if (saldos.has(t.fromId)) saldos.set(t.fromId, (saldos.get(t.fromId) ?? 0) - t.amount);
    if (saldos.has(t.toId)) saldos.set(t.toId, (saldos.get(t.toId) ?? 0) + t.amount);
  }

  return accounts.map((a) => ({ id: a.id, saldo: saldos.get(a.id) ?? a.openingBalance }));
}
