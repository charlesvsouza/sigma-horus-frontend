import { round2, sumMoney } from '@/lib/money';

// Fechamento de caixa do veneralato: saldo final = abertura herdada + entradas − saídas, SEMPRE pelos pagamentos
// efetivamente feitos no período (mesma regra do balancete e do Fechamento do veneralato). Contas a pagar lançadas
// e ainda não pagas são obrigação futura, não saída de caixa; e despesa paga não pode entrar como entrada.
export interface CashCloseInput {
  openingBalance: number;
  accounts: { type: string; amount: number }[];
  payments: { amount: number; accountType: string | null | undefined }[];
}

export interface CashCloseTotals {
  totalReceivables: number; // lançado a receber com vencimento no período (informativo)
  totalPayables: number;    // lançado a pagar com vencimento no período (informativo)
  totalPayments: number;    // entradas: dinheiro recebido no período
  cashOut: number;          // saídas: dinheiro pago no período
  netBalance: number;       // entradas − saídas
  closingBalance: number;   // abertura + entradas − saídas
}

export function computeCashClose({ openingBalance, accounts, payments }: CashCloseInput): CashCloseTotals {
  const totalReceivables = sumMoney(accounts.filter((a) => a.type === 'RECEIVABLE').map((a) => a.amount));
  const totalPayables = sumMoney(accounts.filter((a) => a.type === 'PAYABLE').map((a) => a.amount));
  const totalPayments = sumMoney(payments.filter((p) => p.accountType === 'RECEIVABLE').map((p) => p.amount));
  const cashOut = sumMoney(payments.filter((p) => p.accountType === 'PAYABLE').map((p) => p.amount));
  const netBalance = round2(totalPayments - cashOut);
  return { totalReceivables, totalPayables, totalPayments, cashOut, netBalance, closingBalance: round2(openingBalance + netBalance) };
}
