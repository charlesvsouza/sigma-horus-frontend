import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import AuditoriaClient from './AuditoriaClient';

// Server Component: carrega a trilha de auditoria no servidor (sem fetch-on-mount).
// A trilha cruza vários recursos (contas, membros, cargos...) e não mapeia num
// Resource só do RBAC — barra direto: qualquer papel exceto o obreiro comum.
export default async function AuditoriaPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (lodgeId && normalizeRole(session?.user?.role) === 'member') {
    redirect('/dashboard/portal');
  }
  const items = lodgeId
    ? await withTenant(String(lodgeId), (db) =>
        db.auditLog.findMany({
          where: { lodgeId: String(lodgeId) },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      )
    : [];
  const entries = items.map((e) => {
    let viaSuperadmin = false;
    if (e.after) {
      try {
        viaSuperadmin = Boolean(JSON.parse(e.after)?.viaSuperadmin);
      } catch {
        // after nem sempre é JSON válido (entradas antigas) — ignora.
      }
    }
    return {
      id: e.id,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      after: e.after ?? null,
      createdAt: e.createdAt.toISOString(),
      userId: e.userId,
      userName: e.user?.name ?? null,
      viaSuperadmin,
    };
  });
  return <AuditoriaClient entries={entries} />;
}
