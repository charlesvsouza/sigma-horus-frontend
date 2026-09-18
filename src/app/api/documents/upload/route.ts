import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { normalizeStoragePayload } from '@/lib/storage';
import { NextResponse } from 'next/server';

// Passo 2 do upload de documento: o arquivo já foi enviado direto pro R2 pelo
// navegador (ver ./upload-url/route.ts), usando a URL assinada gerada ali —
// esta rota só recebe METADADOS (JSON, corpo pequeno) e cria o registro.
// Antes o arquivo inteiro passava por aqui como multipart/form-data, o que
// esbarrava no limite de 4,5MB de corpo de requisição do Vercel
// (FUNCTION_PAYLOAD_TOO_LARGE) em PDFs/atas digitalizadas maiores.
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

  const body = await request.json().catch(() => ({}));
  const title = String(body?.title ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;
  const category = body?.category ? String(body.category) : 'general';
  const kind = body?.kind ? String(body.kind) : 'document';
  const content = body?.content ? String(body.content) : null;
  const storage = normalizeStoragePayload(body);

  if (!title || !storage.storageKey) {
    return NextResponse.json({ error: 'Título e arquivo são obrigatórios.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) =>
    db.document.create({
      data: {
        lodgeId: String(lodgeId),
        memberId,
        title,
        kind,
        category,
        status: 'uploaded',
        content,
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
