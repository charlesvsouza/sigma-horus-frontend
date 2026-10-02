import { auth } from '@/lib/auth';
import { canManageDegreeFees } from '@/lib/degree-fee';
import { PLAN_INCLUDE, presentPlan } from '@/lib/degree-fee-server';
import { symbolicSituation } from '@/lib/masonic-degree';
import { normalizeCollectionMode } from '@/lib/collection';
import { withTenant } from '@/lib/prisma';
import TaxasDeGrauClient, { type EligibleMember } from './TaxasDeGrauClient';

// Tesouraria → Taxas de grau: planos de pagamento das taxas de iniciação, elevação
// e exaltação (à vista ou em até 6 cotas). Ver lib/degree-fee.ts.
export default async function TaxasDeGrauPage({ searchParams }: { searchParams: Promise<{ membro?: string; taxa?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const denied = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return denied('Sessão expirada.');
  if (!canManageDegreeFees(session?.user?.role)) return denied('Acesso restrito ao Administrador, ao Venerável e ao Tesoureiro.');

  const data = await withTenant(lodgeId, async (db) => ({
    lodge: await db.lodge.findUnique({ where: { id: lodgeId }, select: { initiationFee: true, elevationFee: true, exaltationFee: true, collectionMode: true } }),
    plans: await db.degreeFeePlan.findMany({ where: { lodgeId }, include: PLAN_INCLUDE, orderBy: { createdAt: 'desc' } }),
    members: await db.member.findMany({
      where: { lodgeId, deceased: false, OR: [{ status: 'candidate', candidateProcess: { is: { closedAt: null, initiatedAt: null } } }, { status: { not: 'candidate' }, initiationDate: { not: null }, exaltationDate: null }] },
      select: { id: true, name: true, status: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true },
      orderBy: { name: 'asc' },
    }),
  }));

  const eligible: EligibleMember[] = data.members.flatMap((m): EligibleMember[] => {
    if (m.status === 'candidate') return [{ id: m.id, name: m.name, kind: 'initiation', situation: 'Candidato' }];
    const s = symbolicSituation(m);
    if (s === 'Aprendiz') return [{ id: m.id, name: m.name, kind: 'elevation', situation: 'Aprendiz' }];
    if (s === 'Companheiro') return [{ id: m.id, name: m.name, kind: 'exaltation', situation: 'Companheiro' }];
    return [];
  });

  const fees = {
    initiation: data.lodge?.initiationFee ?? null,
    elevation: data.lodge?.elevationFee ?? null,
    exaltation: data.lodge?.exaltationFee ?? null,
  };

  return (
    <TaxasDeGrauClient
      plans={data.plans.map((p) => presentPlan(p))}
      eligible={eligible}
      fees={fees}
      asaasMode={normalizeCollectionMode(data.lodge?.collectionMode) === 'asaas'}
      prefill={{ memberId: sp.membro ?? '', kind: sp.taxa ?? '' }}
    />
  );
}
