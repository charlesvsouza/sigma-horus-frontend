import type { Prisma } from '@/generated/prisma/client';
import { computeFinancialAccountBalances } from '@/lib/financial-accounts';
import { sumMoney } from '@/lib/money';

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
): Promise<{ revenue: number; expense: number; balance: number; configured: boolean; caixa: boolean }> {
  const [solidarityCount, payments, fundAccounts] = await Promise.all([
    db.chartAccount.count({ where: { lodgeId, isSolidarity: true } }),
    db.payment.findMany({
      where: { lodgeId, account: { chartAccount: { isSolidarity: true } } },
      select: { amount: true, account: { select: { type: true } } },
    }),
    db.financialAccount.findMany({ where: { lodgeId, purpose: 'tronco', active: true }, select: { id: true, openingBalance: true } }),
  ]);

  // Movimento por categoria (entradas/saídas do Tronco no plano de contas).
  let revenue = 0;
  let expense = 0;
  for (const p of payments) {
    if (p.account?.type === 'RECEIVABLE') revenue += Number(p.amount);
    else if (p.account?.type === 'PAYABLE') expense += Number(p.amount);
  }

  // Com caixa próprio do Tronco, o saldo disponível é o do CAIXA (saldo inicial +
  // tudo que entrou/saiu nele + transferências aprovadas). Sem caixa, cai no
  // movimento por categoria (comportamento antigo).
  if (fundAccounts.length > 0) {
    const ids = fundAccounts.map((f) => f.id);
    const [caixaPayments, transfers] = await Promise.all([
      db.payment.findMany({
        where: { lodgeId, bankAccountId: { in: ids } },
        select: { amount: true, bankAccountId: true, account: { select: { type: true } } },
      }),
      db.accountTransfer.findMany({
        where: { lodgeId, status: 'approved', OR: [{ fromId: { in: ids } }, { toId: { in: ids } }] },
        select: { fromId: true, toId: true, amount: true },
      }),
    ]);
    const saldos = computeFinancialAccountBalances(
      fundAccounts.map((f) => ({ id: f.id, openingBalance: Number(f.openingBalance) })),
      caixaPayments.map((p) => ({ bankAccountId: p.bankAccountId, amount: Number(p.amount), accountType: p.account?.type ?? 'RECEIVABLE' })),
      transfers.map((t) => ({ fromId: t.fromId, toId: t.toId, amount: Number(t.amount) })),
    );
    return { revenue, expense, balance: sumMoney(saldos.map((s) => s.saldo)), configured: solidarityCount > 0, caixa: true };
  }
  return { revenue, expense, balance: revenue - expense, configured: solidarityCount > 0, caixa: false };
}

// Quem pode ver o nome de quem doou ao Tronco (ex.: em Contas a receber ou na
// própria Hospitalaria) — o restante do sistema vê "Doação (irmão)".
const TRONCO_VIEWER_ROLES = new Set(['admin', 'venerable', 'treasurer']);

export function canSeeDonorIdentity(role: string | undefined | null) {
  return TRONCO_VIEWER_ROLES.has(role ?? '');
}

/**
 * Nome a exibir para uma Account ligada ao Tronco de Solidariedade: some
 * pra quem não é Administrador/Venerável/Tesoureiro, mesmo que o papel tenha
 * accounts:read (Secretário, por exemplo, não deve ver quem doou). `isSolidarity`
 * vem do ChartAccount vinculado à Account (mesmo critério de getTroncoBalance).
 * Passe `name` como null/undefined pra não mudar nada quando não há nome a mostrar.
 */
export function donorDisplayName(name: string | null | undefined, isSolidarity: boolean, role: string | undefined | null): string | null {
  if (!name) return name ?? null;
  if (!isSolidarity || canSeeDonorIdentity(role)) return name;
  return 'Doação (irmão)';
}
