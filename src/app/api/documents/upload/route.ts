import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireAccess } from '@/lib/rbac';
import { buildObjectKey, buildPublicUrl, getR2StorageSettings, normalizeStoragePayload } from '@/lib/storage';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = requireAccess(role, 'documents', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const formData = await request.formData();
  const title = String(formData.get('title') ?? '').trim();
  const memberId = formData.get('memberId') ? String(formData.get('memberId')) : null;
  const file = formData.get('file');

  if (!title || !(file instanceof File) || !file.size) {
    return NextResponse.json({ error: 'Título e arquivo são obrigatórios.' }, { status: 400 });
  }

  const settings = getR2StorageSettings();
  if (!settings.accessKeyId || !settings.secretAccessKey || !settings.endpoint || !settings.bucket) {
    return NextResponse.json({ error: 'Configuração de storage incompleta.' }, { status: 500 });
  }

  const storageKey = buildObjectKey(file.name, 'documents');
  const publicUrl = buildPublicUrl(storageKey, settings.publicUrl ?? undefined);
  const storage = normalizeStoragePayload({
    storageKey,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    checksum: null,
    fileUrl: publicUrl,
  });

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: settings.endpoint,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
      },
      forcePathStyle: false,
    });

    await client.send(new PutObjectCommand({
      Bucket: settings.bucket,
      Key: storage.storageKey!,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: storage.mimeType ?? 'application/octet-stream',
      CacheControl: 'public, max-age=31536000',
    }));
  } catch (error) {
    console.error('R2 upload failed', error);
    return NextResponse.json({ error: 'Falha ao enviar arquivo para o storage.' }, { status: 500 });
  }

  const item = await withTenant(String(lodgeId), async (db) =>
    db.document.create({
      data: {
        lodgeId: String(lodgeId),
        memberId: memberId ?? '',
        title,
        kind: 'document',
        category: 'general',
        status: 'uploaded',
        content: null,
        fileUrl: storage.fileUrl,
        fileName: storage.fileName,
        mimeType: storage.mimeType,
        storageKey: storage.storageKey,
        checksum: storage.checksum,
      },
    }),
  );

  return NextResponse.json({ item, storage: { storageKey, publicUrl, bucket: settings.bucket } });
}
