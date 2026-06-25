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
