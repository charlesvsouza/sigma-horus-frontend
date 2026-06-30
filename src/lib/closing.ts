// Lógica pura do relatório de fechamento (Saldo dos Irmãos), separada da rota
// para ser testável sem Prisma. Reconciliação "até a data" por documento.

export interface ReceivableAccountInput {
  memberId: string | null;
  memberName: string;
  type: string; // 'RECEIVABLE' | 'PAYABLE'
  amount: number;
  dueDate: Date;
}

export interface MemberPaymentInput {
  memberId: string | null;
  memberName: string;
  amount: number;
  paidAt: Date;
  accountType?: string | null; // tipo do Account ligado (se houver)
  accountDueDate?: Date | null; // vencimento do Account ligado (se houver)
}

export interface MemberBalance {
  name: string;
  debito: number;
  credito: number;
  saldo: number;
}

const isRevenue = (t?: string | null) => t === 'RECEIVABLE';

/**
 * Saldo por irmão até a data `to`, reconciliado por documento:
 * - débito = cobranças (Account RECEIVABLE) com vencimento ≤ `to`;
 * - crédito = pagamentos de receita ≤ `to`, EXCETO os ligados a um recebível que
 *   só vence depois de `to` (pagamento antecipado) — esses ficam de fora dos dois
 *   lados, evitando crédito sem o débito-par (que distorcia o saldo).
 */
export function reconcileMemberBalances(
  accounts: ReceivableAccountInput[],
  payments: MemberPaymentInput[],
  to: Date,
): MemberBalance[] {
  const byMember = new Map<string, { name: string; debito: number; credito: number }>();

  for (const a of accounts) {
    if (!a.memberId || a.type !== 'RECEIVABLE' || a.dueDate > to) continue;
    const m = byMember.get(a.memberId) ?? { name: a.memberName, debito: 0, credito: 0 };
    m.debito += a.amount;
    byMember.set(a.memberId, m);
  }

  for (const p of payments) {
    if (!p.memberId || !isRevenue(p.accountType) || p.paidAt > to) continue;
    if (p.accountDueDate && p.accountDueDate > to) continue; // pagamento antecipado
    const m = byMember.get(p.memberId) ?? { name: p.memberName, debito: 0, credito: 0 };
    m.credito += p.amount;
    byMember.set(p.memberId, m);
  }

  return [...byMember.values()]
    .map((m) => ({ name: m.name, debito: m.debito, credito: m.credito, saldo: m.debito - m.credito }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
