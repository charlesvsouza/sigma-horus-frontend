import type { Prisma } from '@/generated/prisma/client';
import { auth } from '@/lib/auth';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';
import { requireLodgeAccess } from '@/lib/rbac';
import { reimbursementAccountTitle, reimbursementMarker } from '@/lib/reimbursement';
import { findClosedTermForDate } from '@/lib/term-lock';
import { todayBR } from '@/lib/date-only';
import { NextResponse } from 'next/server';

type Db = Prisma.TransactionClient;

export interface Actor { lodgeId: string; userId: string; memberId: string | null; role: string }

/** Quem está logado (ou null). Papel normalizado em minúsculas. */
export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return null;
  return {
    lodgeId,
    userId: String(session.user.id),
    memberId: session.user.memberId ? String(session.user.memberId) : null,
    role: String(session.user.role ?? 'member').toLowerCase().trim(),
  };
}

export const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
export const isVenerableOrAdmin = (role: string) => role === 'venerable' || role === 'admin';

/** Tesouraria: quem escreve em Contas (Tesoureiro, Administrador, ou cargo que a matriz da loja liberou). */
export async function hasTreasuryWrite(actor: Actor): Promise<boolean> {
  return (await requireLodgeAccess(actor.lodgeId, actor.role, 'accounts', 'write', actor.memberId)).ok;
}

/** Quem pode DIGITAR um pedido em nome de outro irmão: Tesouraria ou Venerável/Administrador. */
export async function canActAsStaff(actor: Actor): Promise<boolean> {
  return isVenerableOrAdmin(actor.role) || (await hasTreasuryWrite(actor));
}

/** Pode ler o pedido e baixar os anexos: o credor, quem digitou, a Tesouraria (leitura em Contas) e o Venerável/Administrador. */
export async function canViewReimbursement(actor: Actor, r: { memberId: string; requestedByUserId: string }): Promise<boolean> {
  if (isVenerableOrAdmin(actor.role)) return true;
  if (actor.userId === r.requestedByUserId || (actor.memberId && actor.memberId === r.memberId)) return true;
  return (await requireLodgeAccess(actor.lodgeId, actor.role, 'accounts', 'read', actor.memberId)).ok;
}

/** A categoria precisa ser despesa desta loja. */
export async function findExpenseChart(db: Db, lodgeId: string, chartAccountId: string) {
  return db.chartAccount.findFirst({ where: { id: chartAccountId, lodgeId, type: 'EXPENSE' }, select: { id: true, code: true, name: true } });
}

/** E-mails ativos dos usuários com algum destes papéis (menos `excludeUserId`). */
export async function staffEmails(db: Db, lodgeId: string, roles: string[], excludeUserId?: string): Promise<string[]> {
  const users = await db.user.findMany({ where: { lodgeId, role: { in: roles }, status: 'active' }, select: { id: true, email: true } });
  return [...new Set(users.filter((u) => u.id !== excludeUserId).map((u) => u.email).filter(Boolean))];
}

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://sigmahorus.com.br').replace(/\/+$/, '');
export const reimbursementsLink = (staff: boolean) => `${appUrl()}${staff ? '/dashboard/reembolsos' : '/dashboard/portal/reembolsos'}`;

/** E-mail sem derrubar a ação que já foi gravada (falha de envio nunca desfaz o fluxo). */
export async function sendMails(to: string[], subject: string, text: string): Promise<void> {
  await Promise.all(to.map((address) => dispatch('email', address, subject, text, EMPTY_CHANNELS).catch(() => null)));
}

/**
 * Cria a conta a pagar do reembolso autorizado: já com todos os dados do pedido (categoria do gasto, valor, descrição,
 * fornecedor, irmão como credor). Sem vínculo de membro (o reembolso é dívida da loja, não débito do irmão) — o nome do
 * credor vai no título e na contraparte. Aprovada (o Venerável já autorizou), vence hoje; "pago" só vem depois,
 * quando a Tesouraria informar conta, data e comprovante.
 */
export async function createReimbursementPayable(
  db: Db,
  lodgeId: string,
  r: { id: string; description: string; vendorName: string | null; chartAccountId: string },
  memberName: string,
  amount: number,
): Promise<{ ok: true; accountId: string } | { ok: false; error: string }> {
  const dueDate = todayBR();
  const locked = await findClosedTermForDate(db, lodgeId, dueDate);
  if (locked) return { ok: false, error: `Período encerrado (${locked.title}). Não é possível lançar a conta a pagar dentro de um veneralato já fechado.` };
  const account = await db.account.create({
    data: {
      lodgeId,
      type: 'PAYABLE',
      title: reimbursementAccountTitle(memberName, r.description),
      amount,
      dueDate,
      status: 'pending',
      approvalStatus: 'approved',
      chartAccountId: r.chartAccountId,
      counterpartyName: memberName,
      description: `${r.vendorName ? `Nota de ${r.vendorName}. ` : ''}Reembolso de gasto pago pelo irmão ${memberName}. ${reimbursementMarker(r.id)}`,
    },
    select: { id: true },
  });
  return { ok: true, accountId: account.id };
}

/** Aviso de pedido parecido: mesmo irmão, mesmo valor e mesma data do gasto (provável nota repetida). */
export async function findDuplicate(db: Db, lodgeId: string, r: { id: string; memberId: string; amount: number; expenseDate: Date }) {
  return db.reimbursement.findFirst({
    where: { lodgeId, id: { not: r.id }, memberId: r.memberId, amount: r.amount, expenseDate: r.expenseDate, status: { in: ['submitted', 'awaiting_vm', 'approved', 'paid'] } },
    select: { id: true },
  });
}
