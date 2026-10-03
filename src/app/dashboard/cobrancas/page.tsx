import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import HistoryWindowNote from '@/components/history-window-note';
import { historyCutoff, wantsFullHistory } from '@/lib/list-window';
import CobrancasClient from './CobrancasClient';
import RecorrenciasTerminando from './RecorrenciasTerminando';
import { loadEndingMothers } from '@/lib/recurring-renewal';
import { canLodgeAccessFor } from '@/lib/rbac';
import { getAccountBalance } from '@/lib/asaas';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { isAsaasMode, paymentInstructions } from '@/lib/collection';
import { chargeUrgency, invoiceOpenBalance } from '@/lib/charge-notice';
import { CLOSED_INVOICE_STATUSES } from '@/lib/portal-invoice';
import { round2, sumMoney } from '@/lib/money';

// Server Component: cobranças + contas + membros no servidor.
export default async function CobrancasPage({ searchParams }: { searchParams: Promise<{ historico?: string }> }) {
  const fullHistory = wantsFullHistory((await searchParams).historico);
  const cutoff = historyCutoff();
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        // Em aberto (qualquer data) + o que venceu nos últimos 12 meses; o resto fica em "Ver todo o histórico".
        hiddenOld: fullHistory ? 0 : await db.invoice.count({ where: { lodgeId: String(lodgeId), status: 'paid', dueDate: { lt: cutoff } } }),
        invoices: await db.invoice.findMany({
          where: { lodgeId: String(lodgeId), ...(fullHistory ? {} : { OR: [{ status: { not: 'paid' } }, { dueDate: { gte: cutoff } }] }) },
          include: {
            account: { select: { id: true, title: true, amount: true, status: true, payments: { select: { amount: true } } } },
            member: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        // Categorias cobráveis: receitas do plano de contas, sem o Tronco (doação tem fluxo próprio).
        chartAccounts: await db.chartAccount.findMany({
          where: { lodgeId: String(lodgeId), type: 'REVENUE', active: true, isSolidarity: false },
          select: { id: true, code: true, name: true, category: true },
          orderBy: { code: 'asc' },
        }),
        members: await db.member.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        endingMothers: await loadEndingMothers(db, String(lodgeId)),
        lodge: await db.lodge.findUnique({
          where: { id: String(lodgeId) },
          select: { collectionMode: true, asaasSettlementAccountId: true, asaasApiKeyEnc: true, asaasEnv: true, pixKey: true, bankName: true, bankAgency: true, bankAccount: true },
        }),
      }))
    : { invoices: [], chartAccounts: [], members: [], lodge: null, hiddenOld: 0, endingMothers: [] };
  const canRenew = lodgeId ? await canLodgeAccessFor({ lodgeId: String(lodgeId), role: session?.user?.role, memberId: null }, 'accounts', 'write') : false;

  // Modo de recebimento da loja. No Modo Asaas mostra o saldo que ainda está no Asaas (a repassar,
  // manualmente, à conta corrente); no Modo Loja, como os irmãos pagam.
  const asaasMode = isAsaasMode(data.lodge);
  let asaasBalance: number | null = null;
  const asaasConfig = asaasMode ? buildLodgeAsaasConfig(data.lodge) : null;
  if (asaasConfig) asaasBalance = await getAccountBalance(asaasConfig).catch(() => null);
  const settlementName = asaasMode && data.lodge?.asaasSettlementAccountId
    ? (await withTenant(String(lodgeId), (db) => db.financialAccount.findUnique({ where: { id: data.lodge!.asaasSettlementAccountId! }, select: { name: true } })))?.name ?? null
    : null;
  const collection = {
    mode: asaasMode ? ('asaas' as const) : ('lodge' as const),
    settlementName,
    balance: asaasBalance,
    instructions: asaasMode ? null : paymentInstructions(data.lodge),
  };

  const invoices = data.invoices.map((i) => {
    // Saldo em aberto (parciais descontados) e vencida no calendário de Brasília — base dos
    // filtros da lista e do painel "Cobrar quem está em aberto".
    const open = !CLOSED_INVOICE_STATUSES.includes(i.status);
    const openBalance = open ? invoiceOpenBalance(i.amount, i.account) : 0;
    return {
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
      asaasInvoiceUrl: i.asaasInvoiceUrl ?? null,
      account: i.account ? { id: i.account.id, title: i.account.title } : null,
      member: i.member ? { id: i.member.id, name: i.member.name } : null,
      openBalance,
      overdue: openBalance > 0 && chargeUrgency(i.dueDate, i.status) === 'overdue',
      memberHasEmail: !!i.member?.email?.trim(),
    };
  });

  // Resumo do que dá para cobrar: só cobranças com irmão e saldo.
  const chargeable = invoices.filter((i) => i.member && i.openBalance > 0);
  const openSummary = {
    invoices: chargeable.length,
    members: new Set(chargeable.map((i) => i.member!.id)).size,
    total: round2(sumMoney(chargeable.map((i) => i.openBalance))),
    overdue: chargeable.filter((i) => i.overdue).length,
    withoutEmail: new Set(chargeable.filter((i) => !i.memberHasEmail).map((i) => i.member!.id)).size,
  };

  return (
    <>
      <RecorrenciasTerminando items={data.endingMothers} canRenew={canRenew} />
      <HistoryWindowNote full={fullHistory} hidden={data.hiddenOld} noun="cobranças" basePath="/dashboard/cobrancas" />
      <CobrancasClient invoices={invoices} chartAccounts={data.chartAccounts} members={data.members} collection={collection} openSummary={openSummary} />
    </>
  );
}
