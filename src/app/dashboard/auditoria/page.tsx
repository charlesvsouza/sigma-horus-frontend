import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import AuditoriaClient from './AuditoriaClient';

// Server Component: carrega a trilha de auditoria no servidor (sem fetch-on-mount).
export default async function AuditoriaPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const items = lodgeId
    ? await withTenant(String(lodgeId), (db) =>
        db.auditLog.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { createdAt: 'desc' }, take: 200 }),
      )
    : [];
  const entries = items.map((e) => ({
    id: e.id,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId,
    after: e.after ?? null,
    createdAt: e.createdAt.toISOString(),
    userId: e.userId,
  }));
  return <AuditoriaClient entries={entries} />;
}
