import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import CobrancasClient from './CobrancasClient';

// Server Component: cobranças + contas + membros no servidor.
export default async function CobrancasPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        invoices: await db.invoice.findMany({
          where: { lodgeId: String(lodgeId) },
          include: { account: { select: { id: true, title: true } }, member: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        accounts: await db.account.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, title: true },
          orderBy: { dueDate: 'asc' },
        }),
        members: await db.member.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      }))
    : { invoices: [], accounts: [], members: [] };

  const invoices = data.invoices.map((i) => ({
    id: i.id,
    number: i.number,
    amount: Number(i.amount),
    dueDate: i.dueDate.toISOString(),
    status: i.status,
    description: i.description ?? null,
    isRecurring: i.isRecurring ?? false,
    recurringInterval: i.recurringInterval ?? null,
    recurringCount: i.recurringCount ?? null,
    nextDueDate: i.nextDueDate ? i.nextDueDate.toISOString() : null,
    account: i.account ? { id: i.account.id, title: i.account.title } : null,
    member: i.member ? { id: i.member.id, name: i.member.name } : null,
  }));

  return <CobrancasClient invoices={invoices} accounts={data.accounts} members={data.members} />;
}
