import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { computeFinancialAccountBalances } from '@/lib/financial-accounts';
import TransferenciasClient from './TransferenciasClient';

// Server Component: contas financeiras + saldo calculado + histórico de transferências.
export default async function TransferenciasPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = normalizeRole(session?.user?.role);

  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        financialAccounts: await db.financialAccount.findMany({
          where: { lodgeId: String(lodgeId) },
          orderBy: [{ active: 'desc' }, { name: 'asc' }],
        }),
        payments: await db.payment.findMany({
          where: { lodgeId: String(lodgeId), bankAccountId: { not: null } },
          select: { bankAccountId: true, amount: true, account: { select: { type: true } } },
        }),
        transfers: await db.accountTransfer.findMany({
          where: { lodgeId: String(lodgeId) },
          include: {
            from: { select: { id: true, name: true, kind: true } },
            to: { select: { id: true, name: true, kind: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      }))
    : { financialAccounts: [], payments: [], transfers: [] };

  const balances = computeFinancialAccountBalances(
    data.financialAccounts.map((f) => ({ id: f.id, openingBalance: Number(f.openingBalance) })),
    data.payments
      .filter((p) => p.bankAccountId && p.account)
      .map((p) => ({ bankAccountId: p.bankAccountId, amount: Number(p.amount), accountType: p.account!.type })),
    data.transfers
      .filter((t) => t.status === 'approved')
      .map((t) => ({ fromId: t.fromId, toId: t.toId, amount: Number(t.amount) })),
  );
  const balanceById = new Map(balances.map((b) => [b.id, b.saldo]));

  const financialAccounts = data.financialAccounts.map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.kind,
    isInvestment: f.isInvestment,
    active: f.active,
    saldo: balanceById.get(f.id) ?? Number(f.openingBalance),
  }));

  const transfers = data.transfers.map((t) => ({
    id: t.id,
    amount: Number(t.amount),
    date: t.date.toISOString(),
    note: t.note ?? null,
    status: t.status,
    from: { id: t.from.id, name: t.from.name, kind: t.from.kind },
    to: { id: t.to.id, name: t.to.name, kind: t.to.kind },
  }));

  return <TransferenciasClient financialAccounts={financialAccounts} transfers={transfers} role={role} />;
}
