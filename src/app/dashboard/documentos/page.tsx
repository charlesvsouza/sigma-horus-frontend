import { auth } from '@/lib/auth';
import { canViewDocument, NOT_CANDIDACY_DOCUMENT } from '@/lib/documents';
import { loadDocumentViewer } from '@/lib/documents-server';
import { withTenant } from '@/lib/prisma';
import DocumentosClient from './DocumentosClient';

// Server Component: carrega documentos + membros no servidor.
export default async function DocumentosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const { items, members, canEdit } = lodgeId
    ? await withTenant(String(lodgeId), async (db) => {
        const viewer = await loadDocumentViewer(db, String(lodgeId), session);
        const rows = await db.document.findMany({
          // A pasta do candidato (sindicância etc.) só abre na ficha dele — nem o Tesoureiro a vê aqui.
          where: { lodgeId: String(lodgeId), ...NOT_CANDIDACY_DOCUMENT },
          include: { member: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return {
          // Cada um só vê o que pode (grau mínimo, "Interno Loja", documentos de outros irmãos).
          items: rows.filter((d) => canViewDocument(d, viewer)),
          members: viewer.seesAll ? await db.member.findMany({ where: { lodgeId: String(lodgeId) }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : [],
          canEdit: viewer.seesAll,
        };
      })
    : { items: [], members: [], canEdit: false };

  const docs = items.map((d) => ({
    id: d.id,
    title: d.title,
    kind: d.kind,
    category: d.category ?? null,
    content: d.content ?? null,
    minDegree: d.minDegree ?? null,
    personal: d.memberId != null,
    storageKey: d.storageKey ?? null,
    member: d.member ? { name: d.member.name } : null,
  }));

  return <DocumentosClient items={docs} members={members} canEdit={canEdit} />;
}
