import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export function buildObjectKey(fileName: string, prefix = 'documents') {
  const safeName = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}/${timestamp}-${safeName}`;
}

export function buildPublicUrl(storageKey: string, baseUrl?: string) {
  if (!storageKey) return null;

  const normalizedBase = (baseUrl ?? process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL ?? '').replace(/\/$/, '');
  if (!normalizedBase) return storageKey;

  const segments = storageKey.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment));
  return `${normalizedBase}/${segments.join('/')}`;
}

export function getR2StorageSettings() {
  return {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? null,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? null,
    bucket: process.env.R2_BUCKET ?? 'sygmahorus-documents',
    endpoint: process.env.R2_ENDPOINT ?? null,
    publicUrl: process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL ?? null,
  };
}

type R2Settings = ReturnType<typeof getR2StorageSettings>;

/**
 * Cria um cliente S3 apontando para o Cloudflare R2 a partir das env vars.
 * Retorna null quando a configuração está incompleta (ex.: dev sem chaves).
 */
export function getR2Client(settings: R2Settings = getR2StorageSettings()) {
  if (!settings.accessKeyId || !settings.secretAccessKey || !settings.endpoint) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: settings.endpoint,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    forcePathStyle: false,
  });
}

/**
 * Gera uma URL de download assinada e de curta duração para um objeto do bucket.
 * Mantém o bucket privado (LGPD): o link só funciona por `expiresInSeconds`.
 */
export async function getPresignedDownloadUrl(storageKey: string, expiresInSeconds = 300) {
  const settings = getR2StorageSettings();
  const client = getR2Client(settings);
  if (!client || !settings.bucket || !storageKey) {
    return null;
  }

  const command = new GetObjectCommand({ Bucket: settings.bucket, Key: storageKey });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Remove o objeto do bucket. Retorna false (sem lançar) quando o storage não
 * está configurado, para não travar a exclusão do registro no banco.
 */
export async function deleteObject(storageKey: string) {
  const settings = getR2StorageSettings();
  const client = getR2Client(settings);
  if (!client || !settings.bucket || !storageKey) {
    return false;
  }

  await client.send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: storageKey }));
  return true;
}

/** Baixa um objeto do bucket como Buffer (usado pelo script de restauração do backup). */
export async function getObjectBuffer(storageKey: string): Promise<Buffer | null> {
  const settings = getR2StorageSettings();
  const client = getR2Client(settings);
  if (!client || !settings.bucket) return null;
  const res = await client.send(new GetObjectCommand({ Bucket: settings.bucket, Key: storageKey }));
  if (!res.Body) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Sobe um buffer bruto pro bucket (usado pelo backup completo — não passa pelo fluxo de Document). */
export async function putObject(storageKey: string, body: Buffer, contentType: string) {
  const settings = getR2StorageSettings();
  const client = getR2Client(settings);
  if (!client || !settings.bucket) return false;
  await client.send(new PutObjectCommand({ Bucket: settings.bucket, Key: storageKey, Body: body, ContentType: contentType }));
  return true;
}

/** Lista as chaves de objetos sob um prefixo (paginado). Usado pela retenção do backup. */
export async function listObjectKeys(prefix: string): Promise<{ key: string; lastModified: Date | undefined }[]> {
  const settings = getR2StorageSettings();
  const client = getR2Client(settings);
  if (!client || !settings.bucket) return [];

  const out: { key: string; lastModified: Date | undefined }[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: settings.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents ?? []) {
      if (obj.Key) out.push({ key: obj.Key, lastModified: obj.LastModified });
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return out;
}

export function normalizeStoragePayload(body: Record<string, unknown>) {
  const storageKey = typeof body.storageKey === 'string' ? body.storageKey : null;
  const fileName = typeof body.fileName === 'string' ? body.fileName : null;
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : null;
  const checksum = typeof body.checksum === 'string' ? body.checksum : null;
  const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl : null;

  return {
    storageKey,
    fileName,
    mimeType,
    checksum,
    fileUrl: fileUrl ?? (storageKey ? buildPublicUrl(storageKey) : null),
  };
}
