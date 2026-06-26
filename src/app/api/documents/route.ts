import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { normalizeStoragePayload } from '@/lib/storage';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'documents', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const items = await withTenant(String(lodgeId), (db) =>
    db.document.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { member: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'documents', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json();
  const title = String(body?.title ?? '').trim();
  const kind = String(body?.kind ?? 'document');
  const category = String(body?.category ?? 'general');
  const status = String(body?.status ?? 'draft');
  const content = String(body?.content ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;
  const storage = normalizeStoragePayload(body as Record<string, unknown>);

  if (!title) {
    return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) =>
    db.document.create({
      data: {
        lodgeId: String(lodgeId),
        memberId: memberId ?? '',
        title,
        kind,
        category,
        status,
        content: content || null,
        fileUrl: storage.fileUrl,
        fileName: storage.fileName,
        mimeType: storage.mimeType,
        storageKey: storage.storageKey,
        checksum: storage.checksum,
      },
      include: { member: { select: { id: true, name: true } } },
    }),
  );

  return NextResponse.json({ item });
}
