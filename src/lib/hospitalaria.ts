import type { Prisma } from '@/generated/prisma/client';

export const BENEFICIARY_LABELS: Record<string, string> = {
  person: 'Pessoa física',
  company: 'Empresa',
  institution: 'Instituição',
};

export const FUNDING_LABELS: Record<string, string> = {
  fund: 'Tronco de Solidariedade',
  donations: 'Doação voluntária dos irmãos',
  mixed: 'Tronco + doações',
};

// Exemplos de campanhas (templates) oferecidos ao criar.
export const CAMPAIGN_TEMPLATES = [
  { title: 'Cadeira de rodas', description: 'Aquisição de cadeira de rodas para irmão, familiar ou assistido.' },
  { title: 'Cesta básica', description: 'Cesta(s) básica(s) para família em necessidade.' },
  { title: 'Auxílio funeral', description: 'Apoio às despesas de funeral de irmão ou dependente.' },
  { title: 'Material escolar', description: 'Material escolar para crianças assistidas.' },
  { title: 'Medicamentos', description: 'Compra de medicamentos para tratamento de saúde.' },
  { title: 'Doação a instituição', description: 'Doação a entidade assistencial (asilo, abrigo, etc.).' },
];

// Saldo do Tronco de Solidariedade: entradas − saídas das contas marcadas como
// solidariedade (benemerência). Faz parte do caixa total, mas é exibido à parte.
export async function getTroncoBalance(
  db: Prisma.TransactionClient,
  lodgeId: string,
): Promise<{ revenue: number; expense: number; balance: number; configured: boolean }> {
  const [solidarityCount, payments] = await Promise.all([
    db.chartAccount.count({ where: { lodgeId, isSolidarity: true } }),
    db.payment.findMany({
      where: { lodgeId, account: { chartAccount: { isSolidarity: true } } },
      select: { amount: true, account: { select: { type: true } } },
    }),
  ]);

  let revenue = 0;
  let expense = 0;
  for (const p of payments) {
    if (p.account?.type === 'RECEIVABLE') revenue += Number(p.amount);
    else if (p.account?.type === 'PAYABLE') expense += Number(p.amount);
  }
  return { revenue, expense, balance: revenue - expense, configured: solidarityCount > 0 };
}
