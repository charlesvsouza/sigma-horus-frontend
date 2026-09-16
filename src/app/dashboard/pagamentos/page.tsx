import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import PagamentosClient from './PagamentosClient';

// Server Component: carrega contas + membros + pagamentos no servidor.
export default async function PagamentosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        accounts: await db.account.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, title: true, type: true, amount: true, bankAccountId: true },
          orderBy: { dueDate: 'asc' },
        }),
        members: await db.member.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        payments: await db.payment.findMany({
          where: { lodgeId: String(lodgeId) },
          include: {
            account: { select: { id: true, title: true, type: true } },
            member: { select: { id: true, name: true } },
            bankAccount: { select: { id: true, name: true, kind: true } },
          },
          orderBy: { paidAt: 'desc' },
        }),
        financialAccounts: await db.financialAccount.findMany({
          where: { lodgeId: String(lodgeId), active: true },
          select: { id: true, name: true, kind: true },
          orderBy: { name: 'asc' },
        }),
      }))
    : { accounts: [], members: [], payments: [], financialAccounts: [] };

  const accounts = data.accounts.map((a) => ({ id: a.id, title: a.title, type: a.type, amount: Number(a.amount), bankAccountId: a.bankAccountId ?? null }));
  const payments = data.payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    paidAt: p.paidAt.toISOString(),
    method: p.method,
    note: p.note ?? null,
    account: p.account ? { id: p.account.id, title: p.account.title, type: p.account.type } : null,
    member: p.member ? { id: p.member.id, name: p.member.name } : null,
    bankAccount: p.bankAccount ? { id: p.bankAccount.id, name: p.bankAccount.name, kind: p.bankAccount.kind } : null,
  }));

  return <PagamentosClient accounts={accounts} members={data.members} payments={payments} financialAccounts={data.financialAccounts} />;
}
