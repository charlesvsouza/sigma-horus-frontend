import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccess, requireLodgeAccess } from '@/lib/rbac';
import { compareOffices } from '@/lib/office-order';
import QuadroGestaoClient from './QuadroGestaoClient';

// Quadro da Gestão: cargos do período em exercício, com foto — só existe
// depois que um veneralato com cargos vinculados foi cadastrado (em Veneralato).
export default async function QuadroGestaoPage() {
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

  const access = await requireLodgeAccess(String(lodgeId), role, 'social', 'read');
  if (!access.ok) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Acesso negado.</p>
      </main>
    );
  }

  const canManage = await canLodgeAccess(String(lodgeId), role, 'members', 'write');

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, term] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
      db.term.findFirst({
        where: { lodgeId: String(lodgeId), status: 'active' },
        include: {
          memberOffices: {
            include: {
              office: { select: { id: true, name: true, order: true } },
              member: { select: { id: true, name: true, photoUrl: true } },
            },
            orderBy: { office: { order: 'asc' } },
          },
        },
        orderBy: { startDate: 'desc' },
      }),
    ]);
    return { lodge, term };
  });

  const term = data.term
    ? {
        id: data.term.id,
        title: data.term.title,
        startDate: data.term.startDate.toISOString(),
        endDate: data.term.endDate ? data.term.endDate.toISOString() : null,
        // Cargos de gestão primeiro (Venerável, Vigilantes, Orador, Secretário, Tesoureiro, M. de Cerimônias).
        memberOffices: [...data.term.memberOffices]
          .sort((a, b) => compareOffices(a.office, b.office) || a.member.name.localeCompare(b.member.name, 'pt-BR'))
          .map((mo) => ({
            id: mo.id,
            office: mo.office,
            member: mo.member,
          })),
      }
    : null;

  return <QuadroGestaoClient lodgeName={data.lodge?.name ?? 'Loja'} crestUrl={data.lodge?.crestUrl ?? null} term={term} canManage={canManage} />;
}
