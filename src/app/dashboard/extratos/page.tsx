import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { computeAccountStatement, type StatementMovementInput } from '@/lib/financial-accounts';
import ExtratosClient from './ExtratosClient';

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function ExtratosPage(props: { searchParams: Promise<{ accountId?: string; from?: string; to?: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const searchParams = await props.searchParams;

  if (!lodgeId) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Sessão expirada.</p>
      </main>
    );
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Acesso negado.</p>
      </main>
    );
  }

  const now = new Date();
  const from = searchParams.from ? new Date(`${searchParams.from}T00:00:00`) : monthStart(now);
  const to = searchParams.to ? new Date(`${searchParams.to}T23:59:59`) : now;

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, financialAccounts] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
      db.financialAccount.findMany({
        where: { lodgeId: String(lodgeId) },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      }),
    ]);

    const accountId = searchParams.accountId ?? financialAccounts[0]?.id ?? null;
    if (!accountId) return { lodge, financialAccounts, accountId: null, statement: null };

    const [payments, transfers] = await Promise.all([
      db.payment.findMany({
        where: { lodgeId: String(lodgeId), bankAccountId: accountId },
        select: {
          amount: true,
          paidAt: true,
          member: { select: { name: true } },
          account: { select: { type: true, title: true, counterpartyName: true } },
        },
      }),
      db.accountTransfer.findMany({
        where: { lodgeId: String(lodgeId), status: 'approved', OR: [{ fromId: accountId }, { toId: accountId }] },
        include: { from: { select: { name: true } }, to: { select: { name: true } } },
      }),
    ]);

    const movements: StatementMovementInput[] = [];
    for (const p of payments) {
      const isIn = p.account?.type === 'RECEIVABLE';
      movements.push({
        date: p.paidAt,
        kind: isIn ? 'payment_in' : 'payment_out',
        description: p.account?.title ?? 'Pagamento',
        reference: p.member?.name ?? p.account?.counterpartyName ?? null,
        amount: Number(p.amount),
      });
    }
    for (const t of transfers) {
      if (t.fromId === accountId) {
        movements.push({ date: t.date, kind: 'transfer_out', description: `Transferência para ${t.to.name}`, reference: t.note, amount: Number(t.amount) });
      }
      if (t.toId === accountId) {
        movements.push({ date: t.date, kind: 'transfer_in', description: `Transferência de ${t.from.name}`, reference: t.note, amount: Number(t.amount) });
      }
    }

    const account = financialAccounts.find((a) => a.id === accountId) ?? null;
    const statement = account ? computeAccountStatement(account.openingBalance, movements, from, to) : null;

    return { lodge, financialAccounts, accountId, statement };
  });

  return (
    <ExtratosClient
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      accounts={data.financialAccounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, bankName: a.bankName, active: a.active, isInvestment: a.isInvestment }))}
      selectedAccountId={data.accountId}
      from={from.toISOString().slice(0, 10)}
      to={searchParams.to ?? now.toISOString().slice(0, 10)}
      statement={data.statement}
    />
  );
}
