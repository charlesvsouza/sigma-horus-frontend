import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { findClosedTermForDate } from '@/lib/term-lock';
import { syncMemberArt002Status } from '@/lib/overdue';
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

    await db.payment.delete({ where: { id } });

    const account = await db.account.findUnique({ where: { id: payment.accountId } });
    if (account) {
      const aggregate = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId: account.id } });
      const totalPaid = Number(aggregate._sum.amount ?? 0);
      const nextStatus = totalPaid >= Number(account.amount) ? 'paid' : 'pending';

      if (nextStatus !== account.status) {
        await db.account.update({ where: { id: account.id }, data: { status: nextStatus } });
      }
      if (account.status === 'paid' && nextStatus !== 'paid') {
        await db.invoice.updateMany({ where: { accountId: account.id, status: 'paid' }, data: { status: 'pending' } });
      }
      if (account.memberId) {
        await syncMemberArt002Status(db, String(lodgeId), account.memberId);
      }
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
