// Lógica pura de saldo por conta financeira (banco/investimento/caixa),
// separada da rota para ser testável sem Prisma. Mesmo espírito de
// lib/closing.ts e lib/hospitalaria.ts (saldo = abertura + entradas − saídas).
// Valores são Float: cada soma é arredondada em centavos (lib/money) para não
// acumular erro de ponto flutuante (100 + 30,10 + 20,20 ≠ 150,30 sem isso).
import { round2 } from '@/lib/money';
import { ledgerDayKey } from '@/lib/ledger-day';

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
    saldos.set(p.bankAccountId, round2((saldos.get(p.bankAccountId) ?? 0) + sinal * p.amount));
  }

  for (const t of approvedTransfers) {
    if (saldos.has(t.fromId)) saldos.set(t.fromId, round2((saldos.get(t.fromId) ?? 0) - t.amount));
    if (saldos.has(t.toId)) saldos.set(t.toId, round2((saldos.get(t.toId) ?? 0) + t.amount));
  }

  return accounts.map((a) => ({ id: a.id, saldo: saldos.get(a.id) ?? a.openingBalance }));
}

// ---------------------------------------------------------------------------
// Extrato por conta financeira (banco/Caixa) — mesmo princípio acima, mas
// para UMA conta e um período: saldo inicial (openingBalance + tudo antes de
// `from`) + movimentação do período, com saldo corrente por linha, saldo
// final = última linha. Fonte: só o que está lançado no Sigma Horus
// (Payment.bankAccountId + AccountTransfer aprovada) — o extrato bancário
// real (OFX) é papel da Conciliação bancária, uma ferramenta de conferência
// separada, não uma segunda fonte de verdade do livro.
export interface StatementMovementInput {
  date: Date;
  kind: 'payment_in' | 'payment_out' | 'transfer_in' | 'transfer_out';
  description: string;
  reference: string | null;
  amount: number; // sempre positivo — o sinal vem de `kind`
}

export interface StatementMovement {
  date: string; // ISO
  kind: StatementMovementInput['kind'];
  description: string;
  reference: string | null;
  amount: number;
  signedAmount: number;
  balance: number;
}

export interface AccountStatement {
  openingBalance: number;
  movements: StatementMovement[];
  closingBalance: number;
  totalIn: number;
  totalOut: number;
}

function signedAmountOf(m: StatementMovementInput): number {
  return m.kind === 'payment_in' || m.kind === 'transfer_in' ? m.amount : -m.amount;
}

/**
 * `from`/`to` podem ser o dia (AAAA-MM-DD) ou uma Date (vira o dia contábil dela). A comparação é por DIA
 * contábil (lib/ledger-day), não por instante — o extrato de um dia e o de um período longo concordam, e um
 * Pix das 22h de Brasília cai no dia em que a tela o mostra. No mesmo dia, vale a ordem em que foram lançados.
 */
export function computeAccountStatement(
  baseOpeningBalance: number,
  allMovements: StatementMovementInput[],
  from: Date | string,
  to: Date | string,
): AccountStatement {
  const fromKey = typeof from === 'string' ? from : ledgerDayKey(from);
  const toKey = typeof to === 'string' ? to : ledgerDayKey(to);
  const sorted = allMovements
    .map((m, i) => ({ m, i, key: ledgerDayKey(m.date) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.m.date.getTime() - b.m.date.getTime() || a.i - b.i));

  let openingBalance = baseOpeningBalance;
  const inRange: StatementMovementInput[] = [];
  for (const { m, key } of sorted) {
    if (key < fromKey) openingBalance = round2(openingBalance + signedAmountOf(m));
    else if (key <= toKey) inRange.push(m);
  }

  let running = openingBalance;
  let totalIn = 0;
  let totalOut = 0;
  const movements: StatementMovement[] = inRange.map((m) => {
    const signedAmount = signedAmountOf(m);
    running = round2(running + signedAmount);
    if (signedAmount >= 0) totalIn = round2(totalIn + signedAmount); else totalOut = round2(totalOut - signedAmount);
    return { ...m, date: m.date.toISOString(), signedAmount, balance: running };
  });

  return { openingBalance, movements, closingBalance: running, totalIn, totalOut };
}
