import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { findClosedTermForDate } from '@/lib/term-lock';
import { checkLedgerOpen } from '@/lib/ledger-lock-server';
import { syncMemberBlock } from '@/lib/member-block-sync';
import { coversAmount } from '@/lib/money';
import { isPlainAccount, syncPlainAccountStatus } from '@/lib/account-status';
import { lateChargeMarker, mainPaymentIdFromMarker } from '@/lib/late-charge';
import { editPayment, type PaymentPatch } from '@/lib/payment-edit-server';
import { NextResponse } from 'next/server';

// Estorno/exclusão de um pagamento lançado errado. Recalcula o status da
// conta associada e, se ela deixar de estar "paga", reabre as cobranças
// (Invoice) que tinham sido marcadas paga por espelhamento (ver POST /api/payments).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;

  const result = await withTenant(String(lodgeId), async (db) => {
    const payment = await db.payment.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!payment) return { error: 'notfound' as const };

    const locked = await findClosedTermForDate(db, String(lodgeId), payment.paidAt);
    if (locked) return { error: 'locked' as const, term: locked };
    const ledger = await checkLedgerOpen(db, String(lodgeId), [payment.paidAt], { userId: session.user.id, what: 'payment.delete' });
    if (!ledger.ok) return { error: 'ledger' as const, message: ledger.error };

    // Antes de apagar: se este pagamento estava conciliado com uma linha de
    // extrato bancário, o FK cai pra null sozinho (onDelete: SetNull), mas o
    // status "matched" fica preso — reabre pra "unmatched" pra não deixar um
    // lançamento fantasma sem opção de reconciliar de novo.
    const linkedBankTx = await db.bankTransaction.findMany({ where: { matchedPaymentId: id }, select: { id: true } });

    await db.payment.delete({ where: { id } });

    // Multa e juros lançados à parte na mesma baixa: estornar a baixa principal estorna o acréscimo
    // junto (a conta dele é apagada e o pagamento vai em cascata). Estornar só o acréscimo mantém a
    // baixa principal e apaga a conta do acréscimo — não deixa o irmão "devendo" multa.
    const lateAccounts = await db.account.findMany({ where: { lodgeId: String(lodgeId), description: lateChargeMarker(id) }, select: { id: true } });
    if (lateAccounts.length > 0) {
      const lateTx = await db.bankTransaction.findMany({ where: { matchedPayment: { accountId: { in: lateAccounts.map((a) => a.id) } } }, select: { id: true } });
      await db.account.deleteMany({ where: { id: { in: lateAccounts.map((a) => a.id) } } });
      if (lateTx.length > 0) await db.bankTransaction.updateMany({ where: { id: { in: lateTx.map((t) => t.id) } }, data: { status: 'unmatched' } });
    }
    const own = await db.account.findUnique({ where: { id: payment.accountId }, select: { id: true, description: true } });
    if (own && mainPaymentIdFromMarker(own.description)) {
      await db.account.delete({ where: { id: own.id } });
      await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'payment', entityId: id, metadata: { accountId: payment.accountId, amount: payment.amount, lateCharge: true } });
      return { ok: true as const };
    }

    if (linkedBankTx.length > 0) {
      await db.bankTransaction.updateMany({ where: { id: { in: linkedBankTx.map((t) => t.id) } }, data: { status: 'unmatched' } });
    }

    const account = await db.account.findUnique({ where: { id: payment.accountId } });
    if (account?.memberId) {
      // Conta de um só membro: mesmo escopo de sempre (accountId inteiro).
      const aggregate = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId: account.id } });
      const totalPaid = Number(aggregate._sum.amount ?? 0);
      const nextStatus = coversAmount(totalPaid, Number(account.amount)) ? 'paid' : 'pending';

      if (nextStatus !== account.status) {
        await db.account.update({ where: { id: account.id }, data: { status: nextStatus } });
      }
      if (account.status === 'paid' && nextStatus !== 'paid') {
        await db.invoice.updateMany({ where: { accountId: account.id, status: 'paid' }, data: { status: 'pending' } });
      }
      await syncMemberBlock(db, String(lodgeId), account.memberId);
    } else if (account && (await isPlainAccount(db, account))) {
      // Conta simples (sem membro nem cobrança): reabre se a soma dos pagamentos
      // restantes não cobre mais o valor.
      await syncPlainAccountStatus(db, { id: account.id, amount: Number(account.amount), status: account.status });
      if (payment.memberId) await syncMemberBlock(db, String(lodgeId), payment.memberId);
    } else if (account && payment.memberId) {
      // Conta compartilhada entre membros (cobrança em massa): reabre só a
      // Invoice DESTE membro, nunca a dos outros que pagaram de verdade.
      const memberInvoices = await db.invoice.findMany({ where: { accountId: account.id, memberId: payment.memberId } });
      const owedByMember = memberInvoices.reduce((sum, i) => sum + Number(i.amount), 0);
      const paidByMember = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId: account.id, memberId: payment.memberId } });
      const totalPaidByMember = Number(paidByMember._sum.amount ?? 0);

      if (!coversAmount(totalPaidByMember, owedByMember)) {
        await db.invoice.updateMany({ where: { accountId: account.id, memberId: payment.memberId, status: 'paid' }, data: { status: 'pending' } });
      }
      await syncMemberBlock(db, String(lodgeId), payment.memberId);
    }

    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'DELETE',
      entity: 'payment',
      entityId: id,
      metadata: { accountId: payment.accountId, amount: payment.amount },
    });

    return { ok: true as const };
  });

  if ('error' in result) {
    if (result.error === 'ledger') return NextResponse.json({ error: result.message, code: 'LEDGER_LOCKED' }, { status: 409 });
    if (result.error === 'notfound') return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
    if (result.error === 'locked') {
      return NextResponse.json(
        { error: `Período encerrado (${result.term.title}). Não é possível estornar pagamento dentro de um veneralato já fechado.` },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({ success: true });
}

// Corrige um pagamento já lançado (valor, data, conta bancária/caixa, observação). Antes só dava para
// estornar e lançar de novo; corrigir só o lançamento deixava o extrato com o valor antigo.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json().catch(() => undefined);
  if (body === undefined || body === null || typeof body !== 'object') return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });
  const patch: PaymentPatch = {};
  if (body.amount !== undefined) patch.amount = Number(body.amount);
  if (body.paidAt !== undefined) patch.paidAt = String(body.paidAt).slice(0, 10);
  if (body.bankAccountId !== undefined) patch.bankAccountId = String(body.bankAccountId);
  if (body.note !== undefined) patch.note = body.note === null ? null : String(body.note);

  const result = await withTenant(String(lodgeId), async (db) => {
    const before = await db.payment.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { amount: true, paidAt: true, bankAccountId: true, note: true } });
    const r = await editPayment(db, { lodgeId: String(lodgeId), paymentId: id, patch, user: { id: String(session.user.id) } });
    if (r.ok && r.changed.length > 0) {
      await logAudit(db, {
        lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'payment', entityId: id,
        before: before ? { amount: before.amount, paidAt: before.paidAt, bankAccountId: before.bankAccountId, note: before.note } : undefined,
        metadata: { changed: r.changed, ...patch, reopenedBankLines: r.unmatchedBankLines },
      });
    }
    return r;
  });

  if (!result.ok) return NextResponse.json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status });
  return NextResponse.json({ ok: true, changed: result.changed, reopenedBankLines: result.unmatchedBankLines });
}
