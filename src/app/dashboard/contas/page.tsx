import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import ContasClient from './ContasClient';

// Server Component: carrega contas + membros + plano de contas no servidor.
export default async function ContasPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        accounts: await db.account.findMany({
          where: { lodgeId: String(lodgeId) },
          include: { member: { select: { id: true, name: true } } },
          orderBy: { dueDate: 'asc' },
        }),
        members: await db.member.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        chartAccounts: await db.chartAccount.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, code: true, name: true, type: true },
          orderBy: { code: 'asc' },
        }),
      }))
    : { accounts: [], members: [], chartAccounts: [] };

  const accounts = data.accounts.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    amount: Number(a.amount),
    dueDate: a.dueDate.toISOString(),
    status: a.status,
    description: a.description ?? null,
    member: a.member ? { id: a.member.id, name: a.member.name } : null,
  }));

  return <ContasClient accounts={accounts} members={data.members} chartAccounts={data.chartAccounts} />;
}
