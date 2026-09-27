import { auth } from '@/lib/auth';
import { todayBR } from '@/lib/date-only';
import { matchNoticesToBank } from '@/lib/notice-bank-match';
import { openBalance, PAYMENT_NOTICE_ENTITY } from '@/lib/portal-dues';
import { withTenant } from '@/lib/prisma';
import PagamentosClient from './PagamentosClient';

// Server Component: carrega contas + membros + pagamentos no servidor.
// `?conta=<id>` (link do e-mail "Já paguei") abre o formulário já preenchido para a baixa.
export default async function PagamentosPage({ searchParams }: { searchParams: Promise<{ conta?: string }> }) {
  const { conta } = await searchParams;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        // Só contas com saldo em aberto: baixar conta quitada é recusado pela API mesmo.
        accounts: await db.account.findMany({
          where: { lodgeId: String(lodgeId), status: { not: 'paid' } },
          select: {
            id: true, title: true, type: true, amount: true, status: true, dueDate: true, bankAccountId: true, memberId: true, counterpartyName: true,
            member: { select: { name: true } },
            payments: { select: { amount: true } },
            _count: { select: { invoices: true } },
          },
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
        notices: await db.auditLog.findMany({
          where: { lodgeId: String(lodgeId), entity: PAYMENT_NOTICE_ENTITY },
          select: { entityId: true, createdAt: true, after: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
        // Créditos do extrato importado ainda não conciliados (últimos 45 dias): casam com os avisos.
        bankLines: await db.bankTransaction.findMany({
          where: { lodgeId: String(lodgeId), status: 'unmatched', amount: { gt: 0 }, date: { gte: new Date(todayBR().getTime() - 45 * 86_400_000) } },
          select: { id: true, date: true, amount: true, description: true },
        }),
      }))
    : { accounts: [], members: [], payments: [], financialAccounts: [], notices: [], bankLines: [] };

  const accounts = data.accounts
    .map((a) => {
      // Conta COMPARTILHADA (cobrança em massa antiga: sem membro, uma Invoice por irmão): os
      // pagamentos de todos os irmãos caem nela, então "valor − pagos" não é saldo de ninguém —
      // filtrar por ele esconderia a conta dos irmãos que ainda devem. Mostra o valor cheio.
      const shared = !a.memberId && a._count.invoices > 0;
      return {
      id: a.id,
      title: a.title,
      type: a.type,
      amount: Number(a.amount),
      balance: shared ? Number(a.amount) : openBalance({ amount: Number(a.amount), status: a.status }, a.payments),
      dueDate: a.dueDate.toISOString(),
      bankAccountId: a.bankAccountId ?? null,
      memberId: a.memberId ?? null,
      who: a.member?.name ?? a.counterpartyName ?? (shared ? 'vários irmãos' : null),
      };
    })
    .filter((a) => a.balance > 0);

  // "Já paguei" do portal (Modo Loja) ainda sem baixa: o último aviso de cada conta em aberto.
  const openById = new Map(accounts.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const rawNotices = data.notices.flatMap((n) => {
    const account = openById.get(n.entityId);
    if (!account || seen.has(n.entityId)) return [];
    seen.add(n.entityId);
    let note: string | null = null;
    let hasReceipt = false;
    try {
      const meta = JSON.parse(n.after ?? '{}') as { note?: string | null; receiptKey?: string };
      note = meta.note ?? null;
      hasReceipt = Boolean(meta.receiptKey);
    } catch { note = null; }
    return [{ accountId: account.id, noticeAt: n.createdAt.toISOString(), noticeDay: todayBR(n.createdAt).toISOString().slice(0, 10), note, hasReceipt, balance: account.balance }];
  });
  const bankMatches = matchNoticesToBank(
    rawNotices.map((n) => ({ accountId: n.accountId, balance: n.balance, noticeAt: new Date(n.noticeAt) })),
    data.bankLines.map((l) => ({ id: l.id, date: l.date, amount: Number(l.amount), description: l.description })),
  );
  const notices = rawNotices.map((n) => ({ ...n, bankMatch: bankMatches.get(n.accountId) ?? null }));

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

  return (
    <PagamentosClient
      accounts={accounts}
      members={data.members}
      payments={payments}
      financialAccounts={data.financialAccounts}
      notices={notices}
      initialAccountId={conta && openById.has(conta) ? conta : null}
    />
  );
}
