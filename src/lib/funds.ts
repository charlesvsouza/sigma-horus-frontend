import type { Prisma } from '@/generated/prisma/client';

// Fundos com caixa próprio: o dinheiro do Tronco de Beneficência e o de Doações e
// Contribuições ficam em contas financeiras (FinancialAccount) separadas, como o
// Caixa e as contas bancárias. `FinancialAccount.purpose` marca de qual fundo é o
// caixa; `ChartAccount.fundPurpose` marca a que fundo pertence a categoria — é ela
// que define o caixa padrão de uma doação ou do custeio de uma campanha.

export type FundPurpose = 'tronco' | 'donations';
export const FUND_PURPOSES: FundPurpose[] = ['tronco', 'donations'];

export const FUND_LABELS: Record<FundPurpose, string> = {
  tronco: 'Tronco de Beneficência',
  donations: 'Doações e Contribuições',
};

export const FUND_ACCOUNT_NAMES: Record<FundPurpose, string> = {
  tronco: 'Caixa do Tronco de Beneficência',
  donations: 'Caixa de Doações e Contribuições',
};

export const ACCOUNT_PURPOSE_LABELS: Record<string, string> = {
  general: 'Geral',
  tronco: 'Tronco de Beneficência',
  donations: 'Doações e Contribuições',
};

export function isFundPurpose(v: unknown): v is FundPurpose {
  return v === 'tronco' || v === 'donations';
}

/** Contas financeiras ativas do fundo (a marcada como padrão primeiro, depois a mais antiga). */
export async function findFundAccounts(db: Prisma.TransactionClient, lodgeId: string, purpose: FundPurpose) {
  return db.financialAccount.findMany({
    where: { lodgeId, purpose, active: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

/** Caixa padrão do fundo (ou null se a loja ainda não tem). */
export async function findFundAccount(db: Prisma.TransactionClient, lodgeId: string, purpose: FundPurpose) {
  const accounts = await findFundAccounts(db, lodgeId, purpose);
  return accounts[0] ?? null;
}

/** Caixa padrão do fundo ao qual a categoria (plano de contas) pertence — ou null. */
export async function fundAccountForChart(db: Prisma.TransactionClient, lodgeId: string, chartAccountId: string | null | undefined) {
  if (!chartAccountId) return null;
  const chart = await db.chartAccount.findFirst({ where: { id: chartAccountId, lodgeId }, select: { fundPurpose: true } });
  return isFundPurpose(chart?.fundPurpose) ? findFundAccount(db, lodgeId, chart.fundPurpose) : null;
}

/** Garante que a loja tenha um caixa para cada fundo (idempotente; não mexe nos existentes). */
export async function ensureFundAccounts(db: Prisma.TransactionClient, lodgeId: string): Promise<number> {
  let created = 0;
  for (const purpose of FUND_PURPOSES) {
    const exists = await db.financialAccount.findFirst({ where: { lodgeId, purpose }, select: { id: true } });
    if (exists) continue;
    await db.financialAccount.create({
      data: { lodgeId, name: FUND_ACCOUNT_NAMES[purpose], kind: 'cash', purpose, openingBalance: 0 },
    });
    created++;
  }
  return created;
}
