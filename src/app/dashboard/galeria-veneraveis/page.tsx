import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { normalizeRole, requireLodgeAccess } from '@/lib/rbac';
import GaleriaVeneraveisClient from './GaleriaVeneraveisClient';

// Galeria de Veneráveis: mural cronológico de todos os Veneráveis da história
// da loja — entradas automáticas (a partir de cargos/períodos já cadastrados
// em Veneralato) mescladas com entradas manuais (Veneráveis antigos sem
// cadastro de Member no sistema).
export default async function GaleriaVeneraveisPage() {
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

  const canManage = ['admin', 'secretary', 'venerable'].includes(normalizeRole(role));

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, memberOffices, manualEntries] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
      db.memberOffice.findMany({
        where: { lodgeId: String(lodgeId), office: { name: { contains: 'venerável', mode: 'insensitive' } } },
        include: {
          member: { select: { id: true, name: true, photoUrl: true } },
          term: { select: { id: true, title: true, startDate: true, endDate: true } },
        },
        orderBy: { term: { startDate: 'asc' } },
      }),
      db.venerableGalleryEntry.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { sortDate: 'asc' } }),
    ]);
    return { lodge, memberOffices, manualEntries };
  });

  const automatic = data.memberOffices.map((mo) => ({
    id: mo.id,
    kind: 'auto' as const,
    name: mo.member.name,
    photoUrl: mo.member.photoUrl,
    periodLabel: `${mo.term.startDate.toLocaleDateString('pt-BR')} a ${mo.term.endDate ? mo.term.endDate.toLocaleDateString('pt-BR') : 'em exercício'}`,
    sortDate: mo.term.startDate.toISOString(),
    termTitle: mo.term.title,
  }));

  const manual = data.manualEntries.map((e) => ({
    id: e.id,
    kind: 'manual' as const,
    name: e.name,
    photoUrl: e.photoUrl,
    periodLabel: e.periodLabel,
    sortDate: e.sortDate.toISOString(),
    notes: e.notes,
  }));

  return (
    <GaleriaVeneraveisClient
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      automatic={automatic}
      manual={manual}
      canManage={canManage}
    />
  );
}
