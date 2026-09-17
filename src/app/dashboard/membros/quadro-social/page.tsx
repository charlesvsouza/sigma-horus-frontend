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
          id: true, name: true, status: true, photoUrl: true,
          initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true,
          initiationLodge: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { lodge, members };
  });

  // Regra (decidida com o dono): compara a "Loja de iniciação" com a loja
  // atual. Iguais → iniciado nesta loja. Diferente e preenchida → filiado.
  // Em branco → "Sem origem" (cadastro incompleto), nunca vira Filiado por
  // falta de dado.
  const lodgeName = (data.lodge?.name ?? '').trim().toLowerCase();
  const members = data.members.map((m) => {
    const initiationLodgeName = (m.initiationLodge ?? '').trim().toLowerCase();
    const origin: 'local' | 'affiliated' | 'unknown' = !initiationLodgeName
      ? 'unknown'
      : initiationLodgeName === lodgeName
        ? 'local'
        : 'affiliated';
    return {
      id: m.id,
      name: m.name,
      status: m.status,
      photoUrl: m.photoUrl,
      initiationDate: m.initiationDate ? m.initiationDate.toISOString() : null,
      elevationDate: m.elevationDate ? m.elevationDate.toISOString() : null,
      exaltationDate: m.exaltationDate ? m.exaltationDate.toISOString() : null,
      installationDate: m.installationDate ? m.installationDate.toISOString() : null,
      origin,
    };
  });

  return <QuadroSocialClient lodgeName={data.lodge?.name ?? 'Loja'} crestUrl={data.lodge?.crestUrl ?? null} members={members} />;
}
