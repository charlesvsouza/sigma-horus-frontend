import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { isEditable } from '@/lib/reimbursement';
import { canViewReimbursement, getActor, unauthorized } from '@/lib/reimbursement-server';
import { deleteObject, getPresignedDownloadUrl } from '@/lib/storage';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string; fileId: string }> };

// GET → abre o anexo (link temporário). Quem vê: o irmão credor, quem digitou, Tesouraria e Venerável/Administrador.
export async function GET(_request: Request, { params }: Ctx) {
  const actor = await getActor();
  if (!actor) return unauthorized();
  const { id, fileId } = await params;

  const found = await withTenant(actor.lodgeId, async (db) => {
    const f = await db.reimbursementFile.findFirst({ where: { id: fileId, reimbursementId: id, lodgeId: actor.lodgeId }, include: { reimbursement: { select: { memberId: true, requestedByUserId: true } } } });
    if (!f) return null;
    return (await canViewReimbursement(actor, f.reimbursement)) ? f : 'denied';
  });
  if (!found) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });
  if (found === 'denied') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  // Defesa extra: a chave precisa ser desta loja.
  if (!found.key.startsWith(`reimbursements/${actor.lodgeId}/`)) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });
  const url = await getPresignedDownloadUrl(found.key, 300).catch(() => null);
  if (!url) return NextResponse.json({ error: 'Storage indisponível no momento.' }, { status: 503 });
  return NextResponse.redirect(url);
}

// DELETE → remove o anexo (só o autor, em rascunho ou devolvido).
export async function DELETE(_request: Request, { params }: Ctx) {
  const actor = await getActor();
  if (!actor) return unauthorized();
  const sub = await requireActiveSubscription(actor.lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });
  const { id, fileId } = await params;

  const result = await withTenant(actor.lodgeId, async (db) => {
    const f = await db.reimbursementFile.findFirst({ where: { id: fileId, reimbursementId: id, lodgeId: actor.lodgeId }, include: { reimbursement: { select: { requestedByUserId: true, status: true } } } });
    if (!f) return { error: 'Arquivo não encontrado.', status: 404 } as const;
    if (f.reimbursement.requestedByUserId !== actor.userId) return { error: 'Só quem digitou o pedido pode remover anexos.', status: 403 } as const;
    if (!isEditable(f.reimbursement.status)) return { error: 'Este pedido já foi enviado e não aceita remover anexos.', status: 409 } as const;
    await db.reimbursementFile.delete({ where: { id: fileId } });
    await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'DELETE', entity: 'reimbursement-file', entityId: fileId, metadata: { reimbursementId: id, name: f.name } });
    return { key: f.key } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  await deleteObject(result.key).catch(() => {});
  return NextResponse.json({ success: true });
}
