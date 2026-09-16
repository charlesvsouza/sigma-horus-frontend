import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import MaterialsClient from './MaterialsClient';

// Server Component: carrega materiais (com disponível calculado), empréstimos
// ativos, membros e ritos no servidor.
export default async function MateriaisPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        materials: await db.material.findMany({
          where: { lodgeId: String(lodgeId) },
          include: {
            rite: { select: { id: true, name: true } },
            loans: { where: { status: 'issued' }, select: { quantity: true } },
          },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        }),
        loans: await db.materialLoan.findMany({
          where: { lodgeId: String(lodgeId), status: 'issued' },
          include: {
            material: { select: { id: true, name: true } },
            member: { select: { id: true, name: true } },
          },
          orderBy: { issuedAt: 'desc' },
        }),
        members: await db.member.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, name: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true },
          orderBy: { name: 'asc' },
        }),
        rites: await db.rite.findMany({ where: { lodgeId: String(lodgeId) }, select: { id: true, name: true }, orderBy: { order: 'asc' } }),
      }))
    : { materials: [], loans: [], members: [], rites: [] };

  const materials = data.materials.map((m) => {
    const issued = m.loans.reduce((sum, l) => sum + l.quantity, 0);
    return {
      id: m.id,
      name: m.name,
      category: m.category ?? null,
      requiredDegree: m.requiredDegree ?? null,
      quantity: m.quantity,
      availableQuantity: m.quantity - issued,
      notes: m.notes ?? null,
      active: m.active,
      rite: m.rite ? { id: m.rite.id, name: m.rite.name } : null,
    };
  });

  const loans = data.loans.map((l) => ({
    id: l.id,
    quantity: l.quantity,
    status: l.status,
    issuedAt: l.issuedAt.toISOString(),
    notes: l.notes ?? null,
    material: { id: l.material.id, name: l.material.name },
    member: { id: l.member.id, name: l.member.name },
  }));

  const members = data.members.map((m) => ({
    id: m.id,
    name: m.name,
    initiationDate: m.initiationDate ? m.initiationDate.toISOString() : null,
    elevationDate: m.elevationDate ? m.elevationDate.toISOString() : null,
    exaltationDate: m.exaltationDate ? m.exaltationDate.toISOString() : null,
    installationDate: m.installationDate ? m.installationDate.toISOString() : null,
  }));

  return <MaterialsClient materials={materials} loans={loans} members={members} rites={data.rites} />;
}
