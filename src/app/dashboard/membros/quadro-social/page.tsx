import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import QuadroSocialClient from './QuadroSocialClient';

export default async function QuadroSocialPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Sessão expirada.</p>
      </main>
    );
  }

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'read');
  if (!access.ok) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Acesso negado.</p>
      </main>
    );
  }

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, members] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
      db.member.findMany({
        where: { lodgeId: String(lodgeId) },
        select: {
          id: true, name: true, status: true,
          initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true,
          originPowerId: true, originLodge: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { lodge, members };
  });

  const members = data.members.map((m) => ({
    id: m.id,
    name: m.name,
    status: m.status,
    initiationDate: m.initiationDate ? m.initiationDate.toISOString() : null,
    elevationDate: m.elevationDate ? m.elevationDate.toISOString() : null,
    exaltationDate: m.exaltationDate ? m.exaltationDate.toISOString() : null,
    installationDate: m.installationDate ? m.installationDate.toISOString() : null,
    hasOrigin: Boolean(m.originPowerId || m.originLodge),
  }));

  return <QuadroSocialClient lodgeName={data.lodge?.name ?? 'Loja'} crestUrl={data.lodge?.crestUrl ?? null} members={members} />;
}
