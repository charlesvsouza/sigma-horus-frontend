import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { buildObjectKey, buildPublicUrl, deleteObject, getR2Client, getR2PublicStorageSettings } from '@/lib/storage';
import { NextResponse } from 'next/server';

// Brasão da loja: identidade visual exibida em relatórios, recibos e demais
// documentos gerados/enviados (e no cabeçalho HTML dos e-mails). Reaproveita
// o mesmo mecanismo de upload do Centro de Documentos (R2), mas atualiza
// Lodge diretamente em vez de criar um Document.
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (normalizeRole(role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem alterar o brasão da loja.' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: 'Selecione uma imagem.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'O brasão precisa ser uma imagem (PNG, JPG ou SVG).' }, { status: 400 });
  }

  // Bucket público dedicado (nunca o de Documentos, que é privado por LGPD) —
  // o brasão precisa ser carregável direto num <img src>, em relatórios/e-mails.
  const settings = getR2PublicStorageSettings();
  const client = getR2Client(settings);
  if (!client || !settings.bucket) {
    return NextResponse.json({ error: 'Configuração de storage público incompleta.' }, { status: 500 });
  }

  const storageKey = buildObjectKey(file.name, 'lodge-crests');
  const publicUrl = buildPublicUrl(storageKey, settings.publicUrl ?? undefined);

  try {
    await client.send(new PutObjectCommand({
      Bucket: settings.bucket,
      Key: storageKey,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000',
    }));
  } catch (error) {
    console.error('R2 upload failed (lodge crest)', error);
    return NextResponse.json({ error: 'Falha ao enviar a imagem para o storage.' }, { status: 500 });
  }

  const previous = await withTenant(String(lodgeId), async (db) => {
    const before = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { crestStorageKey: true } });
    await db.lodge.update({ where: { id: String(lodgeId) }, data: { crestUrl: publicUrl, crestStorageKey: storageKey } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'lodge', entityId: String(lodgeId), metadata: { field: 'crest' } });
    return before;
  });

  if (previous?.crestStorageKey) {
    await deleteObject(previous.crestStorageKey, settings).catch(() => {});
  }

  return NextResponse.json({ ok: true, crestUrl: publicUrl });
}

export async function DELETE() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (normalizeRole(role) !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem alterar o brasão da loja.' }, { status: 403 });
  }

  const previous = await withTenant(String(lodgeId), async (db) => {
    const before = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { crestStorageKey: true } });
    await db.lodge.update({ where: { id: String(lodgeId) }, data: { crestUrl: null, crestStorageKey: null } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'lodge', entityId: String(lodgeId), metadata: { field: 'crest', removed: true } });
    return before;
  });

  if (previous?.crestStorageKey) {
    await deleteObject(previous.crestStorageKey, getR2PublicStorageSettings()).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
