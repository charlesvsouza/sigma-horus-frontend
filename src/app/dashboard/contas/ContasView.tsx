import { auth } from '@/lib/auth';
import { currentExpenseReceipt, EXPENSE_RECEIPT_ENTITY, EXPENSE_RECEIPT_REMOVED_ENTITY } from '@/lib/expense-receipt';
import { donorDisplayName } from '@/lib/hospitalaria';
import { isArt002Enabled } from '@/lib/overdue';
import { approvalSummary, canApproveExpense, evaluateApprovals, isApproverRole } from '@/lib/expense-approval';
import { loadLaunchers } from '@/lib/expense-approval-server';
import { PAYMENT_PROOF_ENTITY } from '@/lib/payment-proof';
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
    ? await withTenant(String(lodgeId), async (db) => {
      const base = {
        // Em aberto (qualquer data) + o que venceu nos últimos 12 meses; o resto fica em "Ver todo o histórico".
        hiddenOld: fullHistory ? 0 : await db.account.count({ where: { lodgeId: String(lodgeId), status: 'paid', dueDate: { lt: cutoff } } }),
        accounts: await db.account.findMany({
          where: { lodgeId: String(lodgeId), ...(fullHistory ? {} : { OR: [{ status: { not: 'paid' } }, { dueDate: { gte: cutoff } }] }) },
          include: {
            member: { select: { id: true, name: true } },
            counterparty: { select: { id: true, name: true, kind: true } },
            bankAccount: { select: { id: true, name: true, kind: true } },
            chartAccount: { select: { name: true, isSolidarity: true, isDues: true } },
            payments: { select: { id: true, amount: true }, orderBy: { paidAt: 'asc' } },
            // Cobrança emitida e ainda aberta no Asaas → "Aguardando Asaas".
            invoices: { where: { asaasPaymentId: { not: null }, status: { in: ['billed', 'overdue'] } }, select: { id: true }, take: 1 },
          },
          orderBy: { dueDate: 'asc' },
        }),
        // Despesas com comprovante anexado (o mais recente vale; remoção posterior encerra).
        receiptRows: await db.auditLog.findMany({ where: { lodgeId: String(lodgeId), entity: { in: [EXPENSE_RECEIPT_ENTITY, EXPENSE_RECEIPT_REMOVED_ENTITY] } }, select: { entity: true, entityId: true, createdAt: true, after: true } }),
        // Comprovantes por baixa (um por pagamento de despesa).
        proofRows: await db.auditLog.findMany({ where: { lodgeId: String(lodgeId), entity: PAYMENT_PROOF_ENTITY }, select: { entityId: true } }),
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
        lodge: await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { art002Enabled: true, name: true, crestUrl: true, expenseDualApproval: true } }),
      };
      // Dupla aprovação: quem já aprovou cada despesa aguardando, e quem a lançou.
      const pendingIds = base.accounts.filter((a) => a.type === 'PAYABLE' && a.approvalStatus === 'pending').map((a) => a.id);
      const dual = Boolean(base.lodge?.expenseDualApproval) && pendingIds.length > 0;
      const approvalRows = dual ? await db.expenseApproval.findMany({ where: { lodgeId: String(lodgeId), accountId: { in: pendingIds } }, select: { accountId: true, userId: true, role: true, valve: true } }) : [];
      const launchers = dual ? await loadLaunchers(db, String(lodgeId), pendingIds) : new Map<string, string>();
      const userIds = [...new Set([...approvalRows.map((r) => r.userId), ...launchers.values()])];
      const people = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true } }) : [];
      return { ...base, approvalRows, launchers, people };
    })
    : { accounts: [], members: [], chartAccounts: [], counterparties: [], financialAccounts: [], lodge: null, hiddenOld: 0, receiptRows: [], proofRows: [], approvalRows: [], launchers: new Map<string, string>(), people: [] as { id: string; name: string; role: string }[] };

  const withReceipt = new Set<string>();
  for (const id of new Set(data.receiptRows.map((r) => r.entityId))) {
    const mine = data.receiptRows.filter((r) => r.entityId === id);
    if (currentExpenseReceipt(mine.filter((r) => r.entity === EXPENSE_RECEIPT_ENTITY), mine.filter((r) => r.entity === EXPENSE_RECEIPT_REMOVED_ENTITY))) withReceipt.add(id);
  }

  const proofPaymentIds = new Set(data.proofRows.map((r) => r.entityId));
  const dualApproval = Boolean(data.lodge?.expenseDualApproval);
  const viewerId = session?.user?.id ? String(session.user.id) : '';
  const personById = new Map(data.people.map((p) => [p.id, p]));
  // Situação da aprovação de cada despesa aguardando (e o que o usuário logado pode fazer nela).
  function approvalInfo(a: { id: string; type: string; approvalStatus: string }) {
    if (a.type !== 'PAYABLE' || a.approvalStatus !== 'pending') return { canApprove: false, canValve: false, summary: null as string | null };
    if (!dualApproval) return { canApprove: role === 'venerable' || role === 'admin', canValve: false, summary: null as string | null };
    const rows = data.approvalRows.filter((r) => r.accountId === a.id);
    const launcherId = data.launchers.get(a.id) ?? null;
    const state = evaluateApprovals(rows, launcherId, { launcherRole: launcherId ? personById.get(launcherId)?.role ?? null : null });
    const can = canApproveExpense({ role, userId: viewerId, launcherUserId: launcherId }, rows);
    return {
      canApprove: isApproverRole(role) && can.ok,
      canValve: can.ok && can.valve && !state.complete,
      summary: approvalSummary(state, rows.map((r) => ({ name: personById.get(r.userId)?.name ?? '—', role: r.role, valve: r.valve }))),
    };
  }
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
      approval: approvalInfo(a),
      hasReceipt: withReceipt.has(a.id),
      proofs: a.payments.filter((p) => proofPaymentIds.has(p.id)).map((p, i) => ({ paymentId: p.id, label: `Comprovante ${i + 1}` })),
      awaitingAsaas: a.invoices.length > 0,
      paid: a.payments.reduce((sum, p) => sum + Number(p.amount), 0),
      chartAccountId: a.chartAccountId ?? null,
      chartName: a.chartAccount?.name ?? null,
      // Doador do Tronco cujo nome está mascarado para este cargo: nem o filtro por pessoa pode revelar quem é.
      personHidden: Boolean(isSolidarity && ((a.member && donorDisplayName(a.member.name, isSolidarity, role) !== a.member.name) || (a.counterparty && donorDisplayName(a.counterparty.name, isSolidarity, role) !== a.counterparty.name))),
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
      <ContasClient accounts={accounts} members={data.members} chartAccounts={chartAccounts} counterparties={data.counterparties} financialAccounts={data.financialAccounts} role={role} startWithForm={startWithForm} lodgeName={data.lodge?.name ?? 'Loja'} crestUrl={data.lodge?.crestUrl ?? null} issuedBy={session?.user?.name ?? null} art002Enabled={isArt002Enabled(data.lodge)} />
    </>
  );
}
