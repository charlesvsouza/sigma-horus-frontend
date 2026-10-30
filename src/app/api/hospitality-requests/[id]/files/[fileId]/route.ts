import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { deleteObject, getPresignedDownloadUrl } from '@/lib/storage';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string; fileId: string }> };

// GET → abre o documento (link temporário): a Hospitalaria (quem lê campanhas) ou o próprio autor do pedido.
export async function GET(_request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  if (!lodgeId || !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, fileId } = await params;

  const staff = await requireLodgeAccess(lodgeId, session.user.role, 'campaigns', 'read');
  const found = await withTenant(lodgeId, (db) =>
    db.hospitalityRequestFile.findFirst({ where: { id: fileId, requestId: id, lodgeId }, include: { request: { select: { memberId: true } } } }),
  );
  const isAuthor = Boolean(found && memberId && found.request.memberId === memberId);
  if (!staff.ok && !isAuthor) return NextResponse.json({ error: staff.error }, { status: staff.status });
  // Defesa extra: a chave precisa ser desta loja.
  if (!found || !found.key.startsWith(`hospitality/${lodgeId}/`)) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  const url = await getPresignedDownloadUrl(found.key, 300).catch(() => null);
  if (!url) return NextResponse.json({ error: 'Storage indisponível no momento.' }, { status: 503 });
  return NextResponse.redirect(url);
}

// DELETE → o autor remove um documento enquanto o pedido está pendente.
export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  if (!lodgeId || !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!memberId) return NextResponse.json({ error: 'Seu usuário não está vinculado a um cadastro de membro.' }, { status: 400 });
  const userId = session.user.id;
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'portal', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const sub = await requireActiveSubscription(lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });
  const { id, fileId } = await params;

  const result = await withTenant(lodgeId, async (db) => {
    const f = await db.hospitalityRequestFile.findFirst({ where: { id: fileId, requestId: id, lodgeId, request: { memberId } }, include: { request: { select: { status: true } } } });
    if (!f) return { error: 'Documento não encontrado.', status: 404 } as const;
    if (f.request.status !== 'pending') return { error: 'Pedido já analisado: os documentos ficam como registro.', status: 409 } as const;
    await db.hospitalityRequestFile.delete({ where: { id: fileId } });
    await logAudit(db, { lodgeId, userId, action: 'DELETE', entity: 'hospitality-request-file', entityId: fileId, metadata: { requestId: id, name: f.name } });
    return { key: f.key } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  await deleteObject(result.key).catch(() => {});
  return NextResponse.json({ success: true });
}
