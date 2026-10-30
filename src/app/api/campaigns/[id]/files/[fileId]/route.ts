import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { deleteObject, getPresignedDownloadUrl } from '@/lib/storage';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string; fileId: string }> };

// GET → abre o documento (link temporário). Quem lê campanhas (Hospitaleiro, Venerável, Administrador…).
export async function GET(_request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'campaigns', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id, fileId } = await params;

  const found = await withTenant(lodgeId, (db) => db.campaignFile.findFirst({ where: { id: fileId, campaignId: id, lodgeId } }));
  // Defesa extra: a chave precisa ser desta loja.
  if (!found || !found.key.startsWith(`campaigns/${lodgeId}/`)) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  const url = await getPresignedDownloadUrl(found.key, 300).catch(() => null);
  if (!url) return NextResponse.json({ error: 'Storage indisponível no momento.' }, { status: 503 });
  return NextResponse.redirect(url);
}

// DELETE → remove o documento (campanha ativa).
export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const access = await requireLodgeAccess(lodgeId, session.user.role, 'campaigns', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const sub = await requireActiveSubscription(lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });
  const { id, fileId } = await params;

  const result = await withTenant(lodgeId, async (db) => {
    const f = await db.campaignFile.findFirst({ where: { id: fileId, campaignId: id, lodgeId }, include: { campaign: { select: { status: true } } } });
    if (!f) return { error: 'Documento não encontrado.', status: 404 } as const;
    if (f.campaign.status !== 'active') return { error: 'Campanha encerrada: os documentos ficam como registro.', status: 409 } as const;
    await db.campaignFile.delete({ where: { id: fileId } });
    await logAudit(db, { lodgeId, userId, action: 'DELETE', entity: 'campaign-file', entityId: fileId, metadata: { campaignId: id, name: f.name } });
    return { key: f.key } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  await deleteObject(result.key).catch(() => {});
  return NextResponse.json({ success: true });
}
