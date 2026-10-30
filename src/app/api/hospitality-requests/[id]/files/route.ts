import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { isCandidateRole } from '@/lib/candidate';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { buildObjectKey, deleteObject, putObject } from '@/lib/storage';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { MAX_CAMPAIGN_FILES, campaignFileError } from '@/lib/campaign-files';
import { NextResponse } from 'next/server';

// O irmão anexa documentos (PDF ou foto de até 4 MB) ao pedido que fez à Hospitalaria — só o autor, enquanto o pedido está pendente.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  if (!lodgeId || !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!memberId) return NextResponse.json({ error: 'Seu usuário não está vinculado a um cadastro de membro.' }, { status: 400 });
  if (isCandidateRole(session.user.role)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  const userId = session.user.id;
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'portal', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const sub = await requireActiveSubscription(lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });
  const { id } = await params;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Escolha o documento (PDF ou foto).' }, { status: 400 });
  const invalid = campaignFileError(file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const check = await withTenant(lodgeId, async (db) => {
    const r = await db.hospitalityRequest.findFirst({ where: { id, lodgeId, memberId }, select: { status: true, _count: { select: { files: true } } } });
    if (!r) return { error: 'Pedido não encontrado.', status: 404 } as const;
    if (r.status !== 'pending') return { error: 'Pedido já analisado: não aceita novos documentos.', status: 409 } as const;
    if (r._count.files >= MAX_CAMPAIGN_FILES) return { error: `Cada pedido aceita até ${MAX_CAMPAIGN_FILES} documentos.`, status: 409 } as const;
    return { ok: true } as const;
  });
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const key = buildObjectKey(file.name, `hospitality/${lodgeId}`);
  const stored = await putObject(key, Buffer.from(await file.arrayBuffer()), file.type).catch(() => false);
  if (!stored) return NextResponse.json({ error: 'Não foi possível enviar o arquivo. Tente de novo.' }, { status: 502 });

  try {
    const saved = await withTenant(lodgeId, async (db) => {
      // Reconfere dentro da gravação: dois envios simultâneos não passam do limite.
      const count = await db.hospitalityRequestFile.count({ where: { lodgeId, requestId: id } });
      if (count >= MAX_CAMPAIGN_FILES) return null;
      const created = await db.hospitalityRequestFile.create({
        data: { lodgeId, requestId: id, key, name: file.name.slice(0, 120), type: file.type, size: file.size, uploadedById: userId },
        select: { id: true, name: true, type: true, size: true, createdAt: true },
      });
      await logAudit(db, { lodgeId, userId, action: 'CREATE', entity: 'hospitality-request-file', entityId: created.id, metadata: { requestId: id, name: created.name } });
      return created;
    });
    if (!saved) {
      await deleteObject(key).catch(() => {});
      return NextResponse.json({ error: `Cada pedido aceita até ${MAX_CAMPAIGN_FILES} documentos.` }, { status: 409 });
    }
    return NextResponse.json({ file: saved });
  } catch (err) {
    await deleteObject(key).catch(() => {});
    throw err;
  }
}
