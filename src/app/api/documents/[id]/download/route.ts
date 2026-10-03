import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccess, requireLodgeAccess } from '@/lib/rbac';
import { canViewDocument, isCandidacyCategory } from '@/lib/documents';
import { loadDocumentViewer } from '@/lib/documents-server';
import { getPresignedDownloadUrl } from '@/lib/storage';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const { id } = await params;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'documents', 'read');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const found = await withTenant(String(lodgeId), async (db) => ({
    item: await db.document.findFirst({
      where: { lodgeId: String(lodgeId), id },
      select: { storageKey: true, memberId: true, category: true, minDegree: true },
    }),
    viewer: await loadDocumentViewer(db, String(lodgeId), session),
  }));
  const item = found.item;

  if (!item?.storageKey) {
    return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });
  }

  // Pasta do candidato: sigilosa, só quem conduz o processo (members:write).
  if (isCandidacyCategory(item.category) && !(await canLodgeAccess(String(lodgeId), role, 'members', 'write'))) {
    return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });
  }

  // Grau mínimo do documento; o irmão (papel Membro) só baixa os próprios e os institucionais — nunca os "Interno Loja".
  if (!canViewDocument(item, found.viewer)) {
    return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });
  }

  const url = await getPresignedDownloadUrl(item.storageKey);
  if (!url) {
    return NextResponse.json({ error: 'Storage indisponível.' }, { status: 503 });
  }

  // Redireciona para a URL assinada de curta duração (bucket permanece privado).
  return NextResponse.redirect(url);
}
