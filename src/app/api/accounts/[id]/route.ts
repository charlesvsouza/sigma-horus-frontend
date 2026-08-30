import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { findClosedTermForDate } from '@/lib/term-lock';
import { syncMemberArt002Status } from '@/lib/overdue';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json();

  const result = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.account.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return { error: 'notfound' as const };

    // Não deixa editar um lançamento que já caiu dentro de um período encerrado
    // (nem no vencimento atual, nem mover para dentro de um período fechado).
    const lockedCurrent = await findClosedTermForDate(db, String(lodgeId), existing.dueDate);
    if (lockedCurrent) return { error: 'locked' as const, term: lockedCurrent };

    const nextDueDate = body?.dueDate ? new Date(body.dueDate) : existing.dueDate;
    if (body?.dueDate) {
      const lockedNext = await findClosedTermForDate(db, String(lodgeId), nextDueDate);
      if (lockedNext) return { error: 'locked' as const, term: lockedNext };
    }

    let chartAccountId = existing.chartAccountId;
    if (body?.chartAccountId !== undefined) {
      chartAccountId = body.chartAccountId ? String(body.chartAccountId) : null;
      if (chartAccountId) {
        const chart = await db.chartAccount.findFirst({ where: { id: chartAccountId, lodgeId: String(lodgeId) }, select: { id: true } });
        chartAccountId = chart?.id ?? null;
      }
    }

    // Recalcula o visto do Venerável quando valor ou tipo mudam — sem isso,
    // dava pra criar uma despesa pequena (aprovada automaticamente) e depois
    // editar o valor pra algo grande sem nunca passar pela aprovação.
    let approvalStatus: string | undefined;
    if (body?.amount !== undefined || body?.type !== undefined) {
      const nextType = body?.type !== undefined ? String(body.type).trim().toUpperCase() : existing.type;
      const nextAmount = body?.amount !== undefined ? Number(body.amount) : Number(existing.amount);
      if (nextType === 'PAYABLE') {
        const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { expenseApprovalThreshold: true } });
        const threshold = lodge?.expenseApprovalThreshold;
        approvalStatus = threshold != null && nextAmount >= threshold ? 'pending' : 'approved';
      } else {
        approvalStatus = 'approved';
      }
    }

    const updated = await db.account.update({
      where: { id },
      data: {
        title: body?.title !== undefined ? String(body.title).trim() : undefined,
        type: body?.type !== undefined ? String(body.type).trim().toUpperCase() : undefined,
        amount: body?.amount !== undefined ? Number(body.amount) : undefined,
        dueDate: body?.dueDate !== undefined ? nextDueDate : undefined,
        status: body?.status !== undefined ? String(body.status).trim() : undefined,
        description: body?.description !== undefined ? (String(body.description).trim() || null) : undefined,
        memberId: body?.memberId !== undefined ? (body.memberId ? String(body.memberId) : null) : undefined,
        isDues: body?.isDues !== undefined ? Boolean(body.isDues) : undefined,
        chartAccountId: body?.chartAccountId !== undefined ? chartAccountId : undefined,
        approvalStatus,
      },
      include: {
        member: { select: { id: true, name: true } },
        chartAccount: { select: { id: true, code: true, name: true, category: true } },
      },
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'UPDATE', entity: 'account', entityId: id, metadata: { fields: Object.keys(body ?? {}) } });

    // O vínculo com membro ou o vencimento podem ter mudado o quadro do Art.002
    // tanto do membro antigo quanto do novo.
    for (const mId of new Set([existing.memberId, updated.memberId].filter(Boolean) as string[])) {
      await syncMemberArt002Status(db, String(lodgeId), mId);
    }

    return { updated };
  });

  if ('error' in result) {
    if (result.error === 'notfound') return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
    if (result.error === 'locked') {
      return NextResponse.json(
        { error: `Período encerrado (${result.term.title}). Não é possível editar lançamento dentro de um veneralato já fechado.` },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({ item: result.updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;

  const result = await withTenant(String(lodgeId), async (db) => {
    const prev = await db.account.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, title: true, memberId: true, dueDate: true } });
    if (!prev) return { error: 'notfound' as const };

    // Mesma trava do PATCH: não deixa apagar um lançamento de período já
    // encerrado (destruiria histórico de uma prestação de contas aprovada).
    const locked = await findClosedTermForDate(db, String(lodgeId), prev.dueDate);
    if (locked) return { error: 'locked' as const, term: locked };

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'DELETE', entity: 'account', entityId: id, metadata: { title: prev.title } });
    await db.account.deleteMany({ where: { id, lodgeId: String(lodgeId) } });
    if (prev.memberId) {
      await syncMemberArt002Status(db, String(lodgeId), prev.memberId);
    }
    return { ok: true as const };
  });

  if ('error' in result) {
    if (result.error === 'notfound') return NextResponse.json({ success: true });
    if (result.error === 'locked') {
      return NextResponse.json(
        { error: `Período encerrado (${result.term.title}). Não é possível excluir lançamento dentro de um veneralato já fechado.` },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
