import type { Prisma } from '@/generated/prisma/client';

export interface CashFlowBucket {
  label: string;
  receivable: number;
  payable: number;
  net: number;
  cumulative: number;
}

export interface ProjectedCashFlow {
  startingBalance: number | null; // saldo do último fechamento de caixa registrado, se houver
  startingBalanceDate: Date | null;
  buckets: CashFlowBucket[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Projeção de fluxo de caixa: agrupa as contas ainda não pagas (a receber e a
 * pagar) por faixa de vencimento — o que já venceu e continua em aberto, e os
 * próximos 30/60/90 dias — com saldo acumulado a partir do último fechamento
 * de caixa registrado (se houver). Puramente informativo/preditivo: não muda
 * nada no banco, só projeta com base no que já está lançado.
 */
export async function getProjectedCashFlow(
  db: Prisma.TransactionClient,
  lodgeId: string,
  now: Date = new Date(),
): Promise<ProjectedCashFlow> {
  const [accounts, lastClose] = await Promise.all([
    db.account.findMany({
      where: { lodgeId, status: { not: 'paid' } },
      select: { type: true, amount: true, dueDate: true },
    }),
    db.cashClose.findFirst({ where: { lodgeId }, orderBy: { closedAt: 'desc' }, select: { closingBalance: true, closedAt: true } }),
  ]);

  const edges = [now, new Date(now.getTime() + 30 * DAY_MS), new Date(now.getTime() + 60 * DAY_MS), new Date(now.getTime() + 90 * DAY_MS)];
  const labels = ['Já vencido (em aberto)', 'Próximos 30 dias', '31–60 dias', '61–90 dias', 'Mais de 90 dias'];

  const sums = labels.map(() => ({ receivable: 0, payable: 0 }));

  for (const a of accounts) {
    const amount = Number(a.amount);
    let idx: number;
    if (a.dueDate < edges[0]) idx = 0;
    else if (a.dueDate < edges[1]) idx = 1;
    else if (a.dueDate < edges[2]) idx = 2;
    else if (a.dueDate < edges[3]) idx = 3;
    else idx = 4;

    if (a.type === 'RECEIVABLE') sums[idx].receivable += amount;
    else sums[idx].payable += amount;
  }

  let cumulative = lastClose?.closingBalance ?? 0;
  const buckets: CashFlowBucket[] = labels.map((label, i) => {
    const net = sums[i].receivable - sums[i].payable;
    cumulative += net;
    return { label, receivable: sums[i].receivable, payable: sums[i].payable, net, cumulative };
  });

  return {
    startingBalance: lastClose?.closingBalance ?? null,
    startingBalanceDate: lastClose?.closedAt ?? null,
    buckets,
  };
}
