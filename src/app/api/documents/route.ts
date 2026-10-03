import { auth } from '@/lib/auth';
import { canViewDocument, NOT_CANDIDACY_DOCUMENT, parseDocumentDegree } from '@/lib/documents';
import { loadDocumentViewer } from '@/lib/documents-server';
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

  const items = await withTenant(String(lodgeId), async (db) => {
    const [all, viewer] = await Promise.all([
      db.document.findMany({
        where: { lodgeId: String(lodgeId), ...NOT_CANDIDACY_DOCUMENT },
        include: { member: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      loadDocumentViewer(db, String(lodgeId), session),
    ]);
    // Cada um só recebe o que pode ver (grau mínimo, "Interno Loja", documentos de outros irmãos).
    return all.filter((d) => canViewDocument(d, viewer));
  });

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

  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });
  const title = String(body?.title ?? '').trim();
  const kind = String(body?.kind ?? 'document');
  const category = String(body?.category ?? 'general');
  const status = String(body?.status ?? 'draft');
  const content = String(body?.content ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;
  // Grau mínimo só vale para documento institucional (sem membro vinculado).
  const minDegree = memberId ? null : parseDocumentDegree(body?.minDegree);
  const storage = normalizeStoragePayload(body as Record<string, unknown>);

  if (!title) {
    return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) =>
    db.document.create({
      data: {
        lodgeId: String(lodgeId),
        memberId,
        minDegree,
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
