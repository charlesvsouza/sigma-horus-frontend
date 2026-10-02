import { auth } from '@/lib/auth';
import { isCandidacyCategory } from '@/lib/documents';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccess, requireLodgeAccess } from '@/lib/rbac';
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

  if (!item || (isCandidacyCategory(item.category) && !(await canLodgeAccess(String(lodgeId), role, 'members', 'write')))) {
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

  // Pasta do candidato: sigilosa, só quem conduz o processo (members:write).
  const target = await withTenant(String(lodgeId), (db) => db.document.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { category: true } }));
  if (!target || (isCandidacyCategory(target.category) && !(await canLodgeAccess(String(lodgeId), role, 'members', 'write')))) {
    return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
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
