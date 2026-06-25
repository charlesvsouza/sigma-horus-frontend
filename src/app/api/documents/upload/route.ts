import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireAccess } from '@/lib/rbac';
import { normalizeStoragePayload } from '@/lib/storage';
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

  const body = await request.json();
  const title = String(body?.title ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;
  const storage = normalizeStoragePayload(body as Record<string, unknown>);

  if (!title || !storage.storageKey) {
    return NextResponse.json({ error: 'Título e arquivo são obrigatórios.' }, { status: 400 });
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

  return NextResponse.json({ item });
}
