import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
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

  const item = await withTenant(String(lodgeId), (db) =>
    db.document.findFirst({
      where: { lodgeId: String(lodgeId), id },
      select: { storageKey: true },
    }),
  );

  if (!item?.storageKey) {
    return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });
  }

  const url = await getPresignedDownloadUrl(item.storageKey);
  if (!url) {
    return NextResponse.json({ error: 'Storage indisponível.' }, { status: 503 });
  }

  // Redireciona para a URL assinada de curta duração (bucket permanece privado).
  return NextResponse.redirect(url);
}
