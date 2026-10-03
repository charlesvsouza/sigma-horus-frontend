import { auth } from '@/lib/auth';
import { canViewDocument, isCandidacyCategory, parseDocumentDegree } from '@/lib/documents';
import { loadDocumentViewer } from '@/lib/documents-server';
import { logAudit } from '@/lib/audit';
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

  const found = await withTenant(String(lodgeId), async (db) => ({
    item: await db.document.findFirst({
      where: { lodgeId: String(lodgeId), id },
      include: { member: { select: { id: true, name: true } } },
    }),
    viewer: await loadDocumentViewer(db, String(lodgeId), session),
  }));
  const item = found.item;

  if (!item || !canViewDocument(item, found.viewer) || (isCandidacyCategory(item.category) && !(await canLodgeAccess(String(lodgeId), role, 'members', 'write')))) {
    return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ item });
}

// Muda o grau mínimo de um documento institucional (a Secretaria reclassifica os documentos antigos).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await request.json().catch(() => ({}));
  const raw = body?.minDegree;
  const minDegree = raw === null || raw === '' ? null : parseDocumentDegree(raw);
  if (raw !== null && raw !== '' && minDegree === null) {
    return NextResponse.json({ error: 'Grau inválido.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const doc = await db.document.findFirst({ where: { id, lodgeId: String(lodgeId) }, select: { id: true, memberId: true, category: true, minDegree: true } });
    if (!doc || isCandidacyCategory(doc.category)) return { notFound: true } as const;
    if (doc.memberId) return { personal: true } as const;
    await db.document.update({ where: { id }, data: { minDegree } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: String(session.user.id), action: 'UPDATE', entity: 'document', entityId: id, before: { minDegree: doc.minDegree }, metadata: { minDegree } });
    return { ok: true } as const;
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  if ('personal' in result) return NextResponse.json({ error: 'O grau só vale para documento institucional (sem membro vinculado).' }, { status: 400 });
  return NextResponse.json({ ok: true, minDegree });
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
