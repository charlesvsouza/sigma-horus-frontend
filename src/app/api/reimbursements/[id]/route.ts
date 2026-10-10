import { logAudit } from '@/lib/audit';
import { todayBR } from '@/lib/date-only';
import { withTenant } from '@/lib/prisma';
import { canCancel, checkReimbursementInput, isEditable } from '@/lib/reimbursement';
import { findExpenseChart, getActor, hasTreasuryWrite, unauthorized } from '@/lib/reimbursement-server';
import { deleteObject } from '@/lib/storage';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// PATCH → edita os dados do pedido (só o autor, em rascunho ou devolvido para correção).
export async function PATCH(request: Request, { params }: Ctx) {
  const actor = await getActor();
  if (!actor) return unauthorized();
  const sub = await requireActiveSubscription(actor.lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });
  const { id } = await params;
  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });
  const input = checkReimbursementInput(body, todayBR());
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const result = await withTenant(actor.lodgeId, async (db) => {
    const r = await db.reimbursement.findFirst({ where: { id, lodgeId: actor.lodgeId } });
    if (!r) return { error: 'Pedido não encontrado.', status: 404 } as const;
    if (r.requestedByUserId !== actor.userId) return { error: 'Só quem digitou o pedido pode alterá-lo.', status: 403 } as const;
    if (!isEditable(r.status)) return { error: 'Este pedido já foi enviado e não pode mais ser alterado.', status: 409 } as const;
    if (input.value.chartAccountId && !(await findExpenseChart(db, actor.lodgeId, input.value.chartAccountId))) {
      return { error: 'Categoria inválida: escolha uma categoria de despesa da loja.', status: 400 } as const;
    }
    await db.reimbursement.update({ where: { id }, data: input.value });
    await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'UPDATE', entity: 'reimbursement', entityId: id, metadata: { step: 'edit', amount: input.value.amount } });
    return { ok: true } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true });
}

// DELETE → rascunho: apaga de vez (e os anexos); enviado e ainda sem decisão: cancela (fica no histórico).
export async function DELETE(_request: Request, { params }: Ctx) {
  const actor = await getActor();
  if (!actor) return unauthorized();
  const sub = await requireActiveSubscription(actor.lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });
  const { id } = await params;
  const isTreasury = await hasTreasuryWrite(actor);

  const result = await withTenant(actor.lodgeId, async (db) => {
    const r = await db.reimbursement.findFirst({ where: { id, lodgeId: actor.lodgeId }, include: { files: { select: { key: true } } } });
    if (!r) return { error: 'Pedido não encontrado.', status: 404 } as const;
    const isAuthor = r.requestedByUserId === actor.userId;
    if (!canCancel(r.status, { isAuthor, isTreasury })) return { error: 'Este pedido não pode mais ser cancelado.', status: 409 } as const;
    if (r.status === 'draft') {
      await db.reimbursement.delete({ where: { id } });
      await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'DELETE', entity: 'reimbursement', entityId: id, metadata: { step: 'draft-deleted' } });
      return { keys: r.files.map((f) => f.key) } as const;
    }
    await db.reimbursement.update({ where: { id }, data: { status: 'cancelled' } });
    await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'UPDATE', entity: 'reimbursement', entityId: id, metadata: { step: 'cancelled', from: r.status } });
    return { keys: [] as string[] } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  await Promise.all(result.keys.map((k) => deleteObject(k).catch(() => {})));
  return NextResponse.json({ success: true });
}
