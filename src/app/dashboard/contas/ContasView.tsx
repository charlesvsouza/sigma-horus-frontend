import { auth } from '@/lib/auth';
import { donorDisplayName } from '@/lib/hospitalaria';
import { isArt002Enabled } from '@/lib/overdue';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import HistoryWindowNote from '@/components/history-window-note';
import { historyCutoff } from '@/lib/list-window';
import ContasClient from './ContasClient';

// Server Component compartilhado por /dashboard/contas (lista) e /dashboard/contas/lancamento
// (a mesma tela com o formulário de lançamento já aberto).
export default async function ContasView({ startWithForm = false, fullHistory = false, basePath = '/dashboard/contas' }: { startWithForm?: boolean; fullHistory?: boolean; basePath?: string }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = normalizeRole(session?.user?.role);
  const cutoff = historyCutoff();
  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        // Em aberto (qualquer data) + o que venceu nos últimos 12 meses; o resto fica em "Ver todo o histórico".
        hiddenOld: fullHistory ? 0 : await db.account.count({ where: { lodgeId: String(lodgeId), status: 'paid', dueDate: { lt: cutoff } } }),
        accounts: await db.account.findMany({
          where: { lodgeId: String(lodgeId), ...(fullHistory ? {} : { OR: [{ status: { not: 'paid' } }, { dueDate: { gte: cutoff } }] }) },
          include: {
            member: { select: { id: true, name: true } },
            counterparty: { select: { id: true, name: true, kind: true } },
            bankAccount: { select: { id: true, name: true, kind: true } },
            chartAccount: { select: { isSolidarity: true, isDues: true } },
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
          select: { id: true, code: true, name: true, type: true, isDues: true },
          orderBy: { code: 'asc' },
        }),
        counterparties: await db.counterparty.findMany({
          where: { lodgeId: String(lodgeId), active: true },
          select: { id: true, name: true, kind: true },
          orderBy: { name: 'asc' },
        }),
        financialAccounts: await db.financialAccount.findMany({
          where: { lodgeId: String(lodgeId), active: true },
          select: { id: true, name: true, kind: true, purpose: true },
          orderBy: { name: 'asc' },
        }),
        lodge: await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { art002Enabled: true } }),
      }))
    : { accounts: [], members: [], chartAccounts: [], counterparties: [], financialAccounts: [], lodge: null, hiddenOld: 0 };

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
      // Mensalidade = flag OU categoria (a mesma regra do Art. 002, DUES_ACCOUNT_WHERE): conta de
      // Mensalidades com o flag desligado (recorrência antiga) não aparece desmarcada ao editar.
      isDues: a.isDues || Boolean(a.chartAccount?.isDues),
      approvalStatus: a.approvalStatus,
      awaitingAsaas: a.invoices.length > 0,
      member: a.member ? { id: a.member.id, name: donorDisplayName(a.member.name, isSolidarity, role)! } : null,
      counterparty: a.counterparty ? { id: a.counterparty.id, name: donorDisplayName(a.counterparty.name, isSolidarity, role)!, kind: a.counterparty.kind } : null,
      bankAccount: a.bankAccount ? { id: a.bankAccount.id, name: a.bankAccount.name, kind: a.bankAccount.kind } : null,
    };
  });

  const chartAccounts = data.chartAccounts.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    type: c.type,
    isDues: c.isDues,
  }));

  return (
    <>
      <HistoryWindowNote full={fullHistory} hidden={data.hiddenOld} noun="lançamentos" basePath={basePath} />
      <ContasClient accounts={accounts} members={data.members} chartAccounts={chartAccounts} counterparties={data.counterparties} financialAccounts={data.financialAccounts} role={role} startWithForm={startWithForm} art002Enabled={isArt002Enabled(data.lodge)} />
    </>
  );
}
