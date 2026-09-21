import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccessFor } from '@/lib/rbac';
import { availableUnits } from '@/lib/inventory';
import { quarantineByMaterial } from '@/lib/inventory-server';
import MaterialsClient from './MaterialsClient';

// Server Component: carrega materiais (com disponível calculado), empréstimos
// ativos, ocorrências de inventário, membros e ritos no servidor.
//
// A tela é gateada aqui (não só no menu): quem não tem leitura de materiais nem
// de inventário volta ao painel. O que cada um vê/faz vem da matriz de Permissões
// (inclusive o papel por cargo do Arquiteto) — o servidor de novo confere nas APIs.
export default async function MateriaisPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const who = { lodgeId: lodgeId ? String(lodgeId) : null, role: session?.user?.role, memberId: session?.user?.memberId };

  const [canReadCatalog, canReadInventory, canManageCatalog, canOperate] = await Promise.all([
    canLodgeAccessFor(who, 'materials', 'read'),
    canLodgeAccessFor(who, 'inventory', 'read'),
    canLodgeAccessFor(who, 'materials', 'write'),
    canLodgeAccessFor(who, 'inventory', 'write'),
  ]);
  if (!lodgeId || !(canReadCatalog || canReadInventory)) redirect('/dashboard');

  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        lodge: await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
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
        incidents: await db.materialIncident.findMany({
          where: { lodgeId: String(lodgeId) },
          include: { material: { select: { id: true, name: true } } },
          orderBy: { reportedAt: 'desc' },
          take: 300,
        }),
        quarantine: (await quarantineByMaterial(db, String(lodgeId))).byMaterial,
        members: canOperate ? await db.member.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, name: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true },
          orderBy: { name: 'asc' },
        }) : [],
        rites: await db.rite.findMany({ where: { lodgeId: String(lodgeId) }, select: { id: true, name: true }, orderBy: { order: 'asc' } }),
      }))
    : { lodge: null, materials: [], loans: [], incidents: [], quarantine: new Map<string, number>(), members: [], rites: [] };

  const materials = data.materials.map((m) => {
    const issued = m.loans.reduce((sum, l) => sum + l.quantity, 0);
    return {
      id: m.id,
      name: m.name,
      category: m.category ?? null,
      requiredDegree: m.requiredDegree ?? null,
      quantity: m.quantity,
      availableQuantity: availableUnits({ quantity: m.quantity, issued, quarantined: data.quarantine.get(m.id) ?? 0 }),
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

  const incidents = data.incidents.map((i) => ({
    id: i.id,
    materialId: i.materialId,
    materialName: i.material.name,
    kind: i.kind,
    quantity: i.quantity,
    requestReplacement: i.requestReplacement,
    status: i.status,
    notes: i.notes ?? null,
    reportedByName: i.reportedByName ?? null,
    reportedAt: i.reportedAt.toISOString(),
    resolvedByName: i.resolvedByName ?? null,
    resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
    resolutionNotes: i.resolutionNotes ?? null,
  }));

  return (
    <MaterialsClient
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      materials={materials}
      loans={loans}
      incidents={incidents}
      canManageCatalog={canManageCatalog}
      canOperate={canOperate}
      members={members}
      rites={data.rites}
    />
  );
}
