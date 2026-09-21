import type { Prisma } from '@/generated/prisma/client';

// Fundos da loja: o Tronco de Beneficência e as Doações e Contribuições são
// CATEGORIAS do plano de contas (centros de custo), não contas financeiras. O
// dinheiro entra e sai pelo banco ou caixa real da loja, com a categoria do fundo;
// o saldo e os relatórios do fundo saem da soma dos lançamentos dessas categorias.
// `ChartAccount.fundPurpose` marca a que fundo a categoria pertence (o Tronco também
// reconhece `isSolidarity`, marcado antes de existir `fundPurpose`).

export type FundPurpose = 'tronco' | 'donations';
export const FUND_PURPOSES: FundPurpose[] = ['tronco', 'donations'];

export const FUND_LABELS: Record<FundPurpose, string> = {
  tronco: 'Tronco de Beneficência',
  donations: 'Doações e Contribuições',
};

export function isFundPurpose(v: unknown): v is FundPurpose {
  return v === 'tronco' || v === 'donations';
}

/** Filtro das categorias (ChartAccount) que pertencem ao fundo. */
export function fundChartWhere(fund: FundPurpose): Prisma.ChartAccountWhereInput {
  return fund === 'tronco' ? { OR: [{ fundPurpose: 'tronco' }, { isSolidarity: true }] } : { fundPurpose: 'donations' };
}

/** Primeira categoria do fundo do tipo pedido (receita ou despesa), pelo código; ou null. */
export async function findFundChart(
  db: Prisma.TransactionClient,
  lodgeId: string,
  fund: FundPurpose,
  type: 'REVENUE' | 'EXPENSE',
) {
  return db.chartAccount.findFirst({
    where: { lodgeId, type, ...fundChartWhere(fund) },
    orderBy: { code: 'asc' },
    select: { id: true },
  });
}

/**
 * Conta financeira (banco/caixa) onde o dinheiro entrou ou saiu: a informada
 * (precisa ser da loja e estar ativa) ou, na falta, a marcada como padrão da loja.
 * `invalid` = foi informada uma conta que não existe/está inativa.
 */
export async function resolveBankAccount(
  db: Prisma.TransactionClient,
  lodgeId: string,
  requestedId?: string | null,
): Promise<{ id: string | null; invalid?: false } | { id: null; invalid: true }> {
  if (requestedId) {
    const ba = await db.financialAccount.findFirst({ where: { id: requestedId, lodgeId, active: true }, select: { id: true } });
    return ba ? { id: ba.id } : { id: null, invalid: true };
  }
  const def = await db.financialAccount.findFirst({ where: { lodgeId, active: true, isDefault: true }, select: { id: true } });
  return { id: def?.id ?? null };
}
