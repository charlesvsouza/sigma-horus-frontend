import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import DocumentosClient from './DocumentosClient';

// Server Component: carrega documentos + membros no servidor.
export default async function DocumentosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const { items, members } = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        items: await db.document.findMany({
          where: { lodgeId: String(lodgeId) },
          include: { member: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        members: await db.member.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      }))
    : { items: [], members: [] };

  const docs = items.map((d) => ({
    id: d.id,
    title: d.title,
    kind: d.kind,
    content: d.content ?? null,
    storageKey: d.storageKey ?? null,
    member: d.member ? { name: d.member.name } : null,
  }));

  return <DocumentosClient items={docs} members={members} />;
}
