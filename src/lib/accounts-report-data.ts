import type { Prisma } from '@/generated/prisma/client';
import { donorDisplayName } from '@/lib/hospitalaria';
import type { AccountReportRowInput } from '@/lib/accounts-report';

export type AccountsReportVariant = 'contas-a-receber' | 'contas-a-pagar' | 'contas-recebidas' | 'contas-pagas';

const TYPE_BY_VARIANT: Record<AccountsReportVariant, 'RECEIVABLE' | 'PAYABLE'> = {
  'contas-a-receber': 'RECEIVABLE',
  'contas-a-pagar': 'PAYABLE',
  'contas-recebidas': 'RECEIVABLE',
  'contas-pagas': 'PAYABLE',
};

// 'aberta' filtra por vencimento da Account (ainda não quitada); 'liquidada'
// filtra por data do PAGAMENTO — uma linha por Payment, pois uma conta pode
// ser quitada em parcelas em datas diferentes (Contas Recebidas/Pagas do PDF).
const KIND_BY_VARIANT: Record<AccountsReportVariant, 'aberta' | 'liquidada'> = {
  'contas-a-receber': 'aberta',
  'contas-a-pagar': 'aberta',
  'contas-recebidas': 'liquidada',
  'contas-pagas': 'liquidada',
};

export async function loadAccountsReportRows(
  db: Prisma.TransactionClient,
  lodgeId: string,
  variant: AccountsReportVariant,
  role: string | undefined | null,
): Promise<AccountReportRowInput[]> {
  const type = TYPE_BY_VARIANT[variant];

  if (KIND_BY_VARIANT[variant] === 'aberta') {
    const accounts = await db.account.findMany({
      where: { lodgeId, type, status: { not: 'paid' } },
      include: {
        member: { select: { id: true, name: true } },
        counterparty: { select: { id: true, name: true } },
        chartAccount: { select: { name: true, isSolidarity: true } },
      },
    });
    return accounts.map((a) => {
      const isSolidarity = a.chartAccount?.isSolidarity ?? false;
      const personId = a.member?.id ?? a.counterparty?.id ?? null;
      const rawName = a.member?.name ?? a.counterparty?.name ?? a.counterpartyName ?? null;
      return {
        id: a.id,
        date: a.dueDate,
        personId,
        personName: donorDisplayName(rawName, isSolidarity, role),
        description: a.title,
        category: a.chartAccount?.name ?? null,
        amount: Number(a.amount),
      };
    });
  }

  const payments = await db.payment.findMany({
    where: { lodgeId, account: { type } },
    include: {
      member: { select: { id: true, name: true } },
      account: {
        select: {
          title: true,
          counterparty: { select: { id: true, name: true } },
          counterpartyName: true,
          chartAccount: { select: { name: true, isSolidarity: true } },
        },
      },
    },
  });
  return payments.map((p) => {
    const isSolidarity = p.account?.chartAccount?.isSolidarity ?? false;
    const personId = p.member?.id ?? p.account?.counterparty?.id ?? null;
    const rawName = p.member?.name ?? p.account?.counterparty?.name ?? p.account?.counterpartyName ?? null;
    return {
      id: p.id,
      date: p.paidAt,
      personId,
      personName: donorDisplayName(rawName, isSolidarity, role),
      description: p.account?.title ?? 'Pagamento',
      category: p.account?.chartAccount?.name ?? null,
      amount: Number(p.amount),
    };
  });
}
