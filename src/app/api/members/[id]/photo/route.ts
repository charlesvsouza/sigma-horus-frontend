import { PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { buildObjectKey, buildPublicUrl, deleteObject, getR2Client, getR2PublicStorageSettings } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { imageUploadError } from '@/lib/upload-guards';

type Ctx = { params: Promise<{ id: string }> };

// Foto do irmão: usada na Galeria de Veneráveis (entrada automática, quando o
// membro serviu como Venerável Mestre) e no Quadro da Gestão do período em
// exercício. Manutenção destas telas é prerrogativa do Secretário, do
// Administrador e do Venerável — não a matriz geral de RBAC de "members"
// (que por padrão não dá write ao Venerável), daí o checkView direto abaixo.
const ALLOWED_ROLES = ['admin', 'secretary', 'venerable'];

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(normalizeRole(session?.user?.role))) {
    return NextResponse.json({ error: 'Apenas Secretário, Venerável ou Administrador podem alterar a foto do membro.' }, { status: 403 });
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

  const storageKey = buildObjectKey(file.name, 'member-photos');
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
    console.error('R2 upload failed (member photo)', error);
    return NextResponse.json({ error: 'Falha ao enviar a imagem para o storage.' }, { status: 500 });
  }

  const previous = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.member.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { photoStorageKey: true } });
    if (!existing) return undefined;
    await db.member.update({ where: { id }, data: { photoUrl: publicUrl, photoStorageKey: storageKey } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'member', entityId: id, metadata: { field: 'photo' } });
    return existing;
  });

  if (previous === undefined) {
    await deleteObject(storageKey, settings).catch(() => {});
    return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
  }
  if (previous?.photoStorageKey) {
    await deleteObject(previous.photoStorageKey, settings).catch(() => {});
  }

  return NextResponse.json({ ok: true, photoUrl: publicUrl });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(normalizeRole(session?.user?.role))) {
    return NextResponse.json({ error: 'Apenas Secretário, Venerável ou Administrador podem alterar a foto do membro.' }, { status: 403 });
  }

  const previous = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.member.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { photoStorageKey: true } });
    if (!existing) return undefined;
    await db.member.update({ where: { id }, data: { photoUrl: null, photoStorageKey: null } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'member', entityId: id, metadata: { field: 'photo', removed: true } });
    return existing;
  });

  if (previous === undefined) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
  if (previous?.photoStorageKey) {
    await deleteObject(previous.photoStorageKey, getR2PublicStorageSettings()).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
