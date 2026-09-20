import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { buildObjectKey, buildPublicUrl, deleteObject, getR2Client, getR2PublicStorageSettings } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { imageUploadError } from '@/lib/upload-guards';
import { requireActiveSubscription } from '@/lib/subscription-guard';

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_ROLES = ['admin', 'secretary', 'venerable'];

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const subscription = await requireActiveSubscription(String(lodgeId));
  if (!subscription.ok) return NextResponse.json({ error: subscription.error, code: subscription.code }, { status: subscription.status });
  if (!ALLOWED_ROLES.includes(normalizeRole(session?.user?.role))) {
    return NextResponse.json({ error: 'Apenas Secretário, Venerável ou Administrador podem editar a galeria.' }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Envie o arquivo como formulário (multipart).' }, { status: 400 });
  const file = formData.get('file');
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: 'Selecione uma imagem.' }, { status: 400 });
  }
  const invalid = imageUploadError(file, { label: 'A foto' });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const settings = getR2PublicStorageSettings();
  const client = getR2Client(settings);
  if (!client || !settings.bucket) {
    return NextResponse.json({ error: 'Configuração de storage público incompleta.' }, { status: 500 });
  }

  const storageKey = buildObjectKey(file.name, 'gallery-entries');
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
    console.error('R2 upload failed (gallery entry photo)', error);
    return NextResponse.json({ error: 'Falha ao enviar a imagem para o storage.' }, { status: 500 });
  }

  const previous = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.venerableGalleryEntry.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { photoStorageKey: true } });
    if (!existing) return undefined;
    await db.venerableGalleryEntry.update({ where: { id }, data: { photoUrl: publicUrl, photoStorageKey: storageKey } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'venerableGalleryEntry', entityId: id, metadata: { field: 'photo' } });
    return existing;
  });

  if (previous === undefined) {
    await deleteObject(storageKey, settings).catch(() => {});
    return NextResponse.json({ error: 'Entrada não encontrada.' }, { status: 404 });
  }
  if (previous?.photoStorageKey) {
    await deleteObject(previous.photoStorageKey, settings).catch(() => {});
  }

  return NextResponse.json({ ok: true, photoUrl: publicUrl });
}
