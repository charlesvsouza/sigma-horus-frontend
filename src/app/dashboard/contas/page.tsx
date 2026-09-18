import { auth } from '@/lib/auth';
import { donorDisplayName } from '@/lib/hospitalaria';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import ContasClient from './ContasClient';

// Server Component: carrega contas + membros + plano de contas no servidor.
export default async function ContasPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = normalizeRole(session?.user?.role);
  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        accounts: await db.account.findMany({
          where: { lodgeId: String(lodgeId) },
          include: {
            member: { select: { id: true, name: true } },
            counterparty: { select: { id: true, name: true, kind: true } },
            bankAccount: { select: { id: true, name: true, kind: true } },
            chartAccount: { select: { isSolidarity: true } },
            // Cobrança emitida e ainda aberta no Asaas → "Aguardando Asaas".
            invoices: { where: { asaasPaymentId: { not: null }, status: { in: ['billed', 'overdue'] } }, select: { id: true }, take: 1 },
          },
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
        counterparties: await db.counterparty.findMany({
          where: { lodgeId: String(lodgeId), active: true },
          select: { id: true, name: true, kind: true },
          orderBy: { name: 'asc' },
        }),
        financialAccounts: await db.financialAccount.findMany({
          where: { lodgeId: String(lodgeId), active: true },
          select: { id: true, name: true, kind: true },
          orderBy: { name: 'asc' },
        }),
      }))
    : { accounts: [], members: [], chartAccounts: [], counterparties: [], financialAccounts: [] };

  const accounts = data.accounts.map((a) => {
    const isSolidarity = a.chartAccount?.isSolidarity ?? false;
    return {
      id: a.id,
      title: a.title,
      type: a.type,
      amount: Number(a.amount),
      dueDate: a.dueDate.toISOString(),
      status: a.status,
      description: a.description ?? null,
      isDues: a.isDues,
      approvalStatus: a.approvalStatus,
      awaitingAsaas: a.invoices.length > 0,
      member: a.member ? { id: a.member.id, name: donorDisplayName(a.member.name, isSolidarity, role)! } : null,
      counterparty: a.counterparty ? { id: a.counterparty.id, name: donorDisplayName(a.counterparty.name, isSolidarity, role)!, kind: a.counterparty.kind } : null,
      bankAccount: a.bankAccount ? { id: a.bankAccount.id, name: a.bankAccount.name, kind: a.bankAccount.kind } : null,
    };
  });

  return <ContasClient accounts={accounts} members={data.members} chartAccounts={data.chartAccounts} counterparties={data.counterparties} financialAccounts={data.financialAccounts} role={role} />;
}
