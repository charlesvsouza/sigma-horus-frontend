import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { deleteObject } from '@/lib/storage';
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
      include: { member: { select: { id: true, name: true } } },
    }),
  );

  if (!item) {
    return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const { id } = await params;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'documents', 'write');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const removed = await withTenant(String(lodgeId), (db) =>
    db.document.delete({ where: { id, lodgeId: String(lodgeId) } }),
  );

  // Remove o objeto no R2 depois de apagar o registro. Não falha a requisição
  // se o storage estiver indisponível — o registro já foi removido.
  if (removed.storageKey) {
    try {
      await deleteObject(removed.storageKey);
    } catch (error) {
      console.error('R2 delete failed', error);
    }
  }

  return NextResponse.json({ ok: true });
}
