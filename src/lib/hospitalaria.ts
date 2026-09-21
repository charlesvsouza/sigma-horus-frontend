import type { Prisma } from '@/generated/prisma/client';
import { fundChartWhere } from '@/lib/funds';
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

// Saldo do Tronco de Solidariedade: entradas − saídas dos pagamentos lançados nas
// categorias do Tronco (plano de contas). O Tronco não tem caixa próprio: o dinheiro
// está nos bancos/caixa da loja, e este é o quanto dele pertence à benemerência.
export async function getTroncoBalance(
  db: Prisma.TransactionClient,
  lodgeId: string,
): Promise<{ revenue: number; expense: number; balance: number; configured: boolean }> {
  const where = fundChartWhere('tronco');
  const [chartCount, payments] = await Promise.all([
    db.chartAccount.count({ where: { lodgeId, ...where } }),
    db.payment.findMany({
      where: { lodgeId, account: { chartAccount: where } },
      select: { amount: true, account: { select: { type: true } } },
    }),
  ]);

  const revenue = sumMoney(payments.filter((p) => p.account?.type === 'RECEIVABLE').map((p) => Number(p.amount)));
  const expense = sumMoney(payments.filter((p) => p.account?.type === 'PAYABLE').map((p) => Number(p.amount)));
  return { revenue, expense, balance: sumMoney([revenue, -expense]), configured: chartCount > 0 };
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
