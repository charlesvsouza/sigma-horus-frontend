import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole, requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// PASSO 2: o Venerável (ou Admin) aprova/rejeita a transferência criada pelo
// Tesoureiro. Só a aprovação efetiva a movimentação de saldo (ver
// lib/financial-accounts.ts: computeFinancialAccountBalances só soma
// transferências com status='approved').
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = normalizeRole(session?.user?.role);
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const action = String(body?.action ?? '').trim();

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  }

  if (action === 'approve' && role !== 'venerable' && role !== 'admin') {
    return NextResponse.json({ error: 'Apenas o Venerável Mestre ou o Administrador podem aprovar transferências.' }, { status: 403 });
  }
  if (action === 'reject' && role !== 'venerable' && role !== 'admin') {
    // Rejeitar pode ser feito por quem aprova OU por quem tem acesso de escrita
    // em accounts (ex.: o próprio Tesoureiro desistindo antes da aprovação).
    const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'write');
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const transfer = await db.accountTransfer.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!transfer) return { notFound: true as const };
    if (transfer.status !== 'pending') return { alreadyDecided: true as const };

    // Só decide quem ainda encontra a transferência pendente: aprovações simultâneas
    // (clique duplo) não repetem a decisão nem a auditoria.
    const claimed = await db.accountTransfer.updateMany({
      where: { id, lodgeId: String(lodgeId), status: 'pending' },
      data:
        action === 'approve'
          ? { status: 'approved', approvedById: session!.user.id, approvedAt: new Date() }
          : { status: 'rejected', approvedById: session!.user.id, approvedAt: new Date() },
    });
    if (claimed.count === 0) return { alreadyDecided: true as const };
    const updated = await db.accountTransfer.findUniqueOrThrow({
      where: { id },
      include: {
        from: { select: { id: true, name: true, kind: true } },
        to: { select: { id: true, name: true, kind: true } },
      },
    });

    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session!.user.id,
      action: 'UPDATE',
      entity: 'accountTransfer',
      entityId: id,
      metadata: { action, amount: transfer.amount },
    });

    return { updated };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Transferência não encontrada.' }, { status: 404 });
  if ('alreadyDecided' in result) return NextResponse.json({ error: 'Esta transferência já foi decidida.' }, { status: 409 });

  return NextResponse.json({ item: result.updated });
}
