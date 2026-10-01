import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { artBytesMatch, artUploadError } from '@/lib/certificate-art';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { buildObjectKey, deleteObject, putObject } from '@/lib/storage';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// Arte do certificado de presença no modelo da loja (fundo do diploma). Fica no bucket PRIVADO
// (só o servidor lê, para montar o PDF). Trocar a arte mantém o layout gravado — as posições dos
// campos são da arte e são configuradas pela equipe do Sigma Horus (lib/certificate-art.ts).
// Só o Administrador, como o brasão.

async function guard() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !session?.user?.id) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const subscription = await requireActiveSubscription(lodgeId);
  if (!subscription.ok) return { error: NextResponse.json({ error: subscription.error, code: subscription.code }, { status: subscription.status }) };
  if (normalizeRole(session.user.role) !== 'admin') {
    return { error: NextResponse.json({ error: 'Apenas administradores podem alterar a arte do certificado.' }, { status: 403 }) };
  }
  return { lodgeId, userId: session.user.id };
}

export async function POST(request: Request) {
  const g = await guard();
  if ('error' in g) return g.error;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: 'Selecione o arquivo da arte.' }, { status: 400 });
  const check = artUploadError(file);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!artBytesMatch(bytes, check.type)) return NextResponse.json({ error: 'O conteúdo do arquivo não confere com o tipo (JPG, PNG ou PDF).' }, { status: 400 });

  const storageKey = buildObjectKey(`${g.lodgeId}.${check.type}`, 'certificate-art');
  const contentType = check.type === 'pdf' ? 'application/pdf' : check.type === 'png' ? 'image/png' : 'image/jpeg';
  try {
    if (!(await putObject(storageKey, bytes, contentType))) return NextResponse.json({ error: 'Storage não configurado.' }, { status: 500 });
  } catch (error) {
    console.error('R2 upload failed (certificate art)', error);
    return NextResponse.json({ error: 'Falha ao enviar a arte para o storage.' }, { status: 500 });
  }

  const previous = await withTenant(g.lodgeId, async (db) => {
    const before = await db.lodge.findUnique({ where: { id: g.lodgeId }, select: { certificateArtKey: true } });
    await db.lodge.update({ where: { id: g.lodgeId }, data: { certificateArtKey: storageKey, certificateArtType: check.type } });
    await logAudit(db, { lodgeId: g.lodgeId, userId: g.userId, action: 'UPDATE', entity: 'lodge', entityId: g.lodgeId, metadata: { field: 'certificateArt', type: check.type } });
    return before;
  });
  if (previous?.certificateArtKey) await deleteObject(previous.certificateArtKey).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const g = await guard();
  if ('error' in g) return g.error;
  const previous = await withTenant(g.lodgeId, async (db) => {
    const before = await db.lodge.findUnique({ where: { id: g.lodgeId }, select: { certificateArtKey: true } });
    await db.lodge.update({ where: { id: g.lodgeId }, data: { certificateArtKey: null, certificateArtType: null } });
    await logAudit(db, { lodgeId: g.lodgeId, userId: g.userId, action: 'UPDATE', entity: 'lodge', entityId: g.lodgeId, metadata: { field: 'certificateArt', removed: true } });
    return before;
  });
  if (previous?.certificateArtKey) await deleteObject(previous.certificateArtKey).catch(() => {});
  return NextResponse.json({ ok: true });
}
