import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getPresignedDownloadUrl } from '@/lib/storage';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

// Download do balaustre por qualquer membro da loja — gate por "portal" (não
// "members"), que é o resource que o papel member realmente tem (mesmo
// padrão de /api/portal/agenda).
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'portal', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const item = await withTenant(String(lodgeId), (db) =>
    db.session.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { minutesStorageKey: true } }),
  );

  if (!item?.minutesStorageKey) {
    return NextResponse.json({ error: 'Balaustre não encontrado.' }, { status: 404 });
  }

  const url = await getPresignedDownloadUrl(item.minutesStorageKey);
  if (!url) {
    return NextResponse.json({ error: 'Storage indisponível.' }, { status: 503 });
  }

  return NextResponse.redirect(url);
}
