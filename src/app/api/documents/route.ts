import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const access = requireAccess(role, 'documents', 'read');
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

  const access = requireAccess(role, 'documents', 'write');
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
  const fileUrl = body?.fileUrl ? String(body.fileUrl) : null;
  const fileName = body?.fileName ? String(body.fileName) : null;
  const mimeType = body?.mimeType ? String(body.mimeType) : null;
  const storageKey = body?.storageKey ? String(body.storageKey) : null;
  const checksum = body?.checksum ? String(body.checksum) : null;

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
        fileUrl,
        fileName,
        mimeType,
        storageKey,
        checksum,
      },
      include: { member: { select: { id: true, name: true } } },
    }),
  );

  return NextResponse.json({ item });
}
