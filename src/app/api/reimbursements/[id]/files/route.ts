import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { isEditable, MAX_REIMBURSEMENT_FILES } from '@/lib/reimbursement';
import { getActor, unauthorized } from '@/lib/reimbursement-server';
import { buildObjectKey, deleteObject, putObject } from '@/lib/storage';
import { receiptUploadError } from '@/lib/upload-guards';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// Anexa um arquivo (foto ou PDF de até 4 MB) da nota/recibo. Só o autor, em rascunho ou devolvido; no máximo 3 por pedido.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return unauthorized();
  const sub = await requireActiveSubscription(actor.lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });
  const { id } = await params;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Escolha o arquivo da nota ou do recibo (PDF ou foto).' }, { status: 400 });
  const invalid = receiptUploadError(file);
  if (invalid) return NextResponse.json({ error: invalid.replace('O comprovante', 'O arquivo') }, { status: 400 });

  const check = await withTenant(actor.lodgeId, async (db) => {
    const r = await db.reimbursement.findFirst({ where: { id, lodgeId: actor.lodgeId }, select: { requestedByUserId: true, status: true, _count: { select: { files: true } } } });
    if (!r) return { error: 'Pedido não encontrado.', status: 404 } as const;
    if (r.requestedByUserId !== actor.userId) return { error: 'Só quem digitou o pedido pode anexar arquivos.', status: 403 } as const;
    if (!isEditable(r.status)) return { error: 'Este pedido já foi enviado e não aceita novos anexos.', status: 409 } as const;
    if (r._count.files >= MAX_REIMBURSEMENT_FILES) return { error: `Cada pedido aceita até ${MAX_REIMBURSEMENT_FILES} arquivos.`, status: 409 } as const;
    return { ok: true } as const;
  });
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const key = buildObjectKey(file.name, `reimbursements/${actor.lodgeId}`);
  const stored = await putObject(key, Buffer.from(await file.arrayBuffer()), file.type).catch(() => false);
  if (!stored) return NextResponse.json({ error: 'Não foi possível enviar o arquivo. Tente de novo.' }, { status: 502 });

  try {
    const saved = await withTenant(actor.lodgeId, async (db) => {
      // Reconfere dentro da gravação: dois envios simultâneos não passam do limite.
      const count = await db.reimbursementFile.count({ where: { lodgeId: actor.lodgeId, reimbursementId: id } });
      if (count >= MAX_REIMBURSEMENT_FILES) return null;
      const created = await db.reimbursementFile.create({
        data: { lodgeId: actor.lodgeId, reimbursementId: id, key, name: file.name.slice(0, 120), type: file.type, size: file.size },
        select: { id: true, name: true, type: true, size: true },
      });
      await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'CREATE', entity: 'reimbursement-file', entityId: created.id, metadata: { reimbursementId: id, name: created.name } });
      return created;
    });
    if (!saved) {
      await deleteObject(key).catch(() => {});
      return NextResponse.json({ error: `Cada pedido aceita até ${MAX_REIMBURSEMENT_FILES} arquivos.` }, { status: 409 });
    }
    return NextResponse.json({ file: saved });
  } catch (err) {
    await deleteObject(key).catch(() => {});
    throw err;
  }
}
