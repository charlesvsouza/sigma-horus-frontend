import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { canManageDegreeFees } from '@/lib/degree-fee';
import { PLAN_INCLUDE, presentPlan } from '@/lib/degree-fee-server';
import { getLetterhead } from '@/lib/letterhead';
import { getReportSignatories } from '@/lib/report-signatories';
import { withTenant } from '@/lib/prisma';
import ContratoClient from './ContratoClient';

// Contrato do plano de taxa de grau (para assinar e arquivar). Abre para quem
// gerencia as taxas e para o próprio irmão do plano (pelo portal).
export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) notFound();
  const staff = canManageDegreeFees(session?.user?.role);
  const ownMemberId = session?.user?.memberId ? String(session.user.memberId) : null;

  const data = await withTenant(lodgeId, async (db) => {
    const plan = await db.degreeFeePlan.findFirst({ where: { id, lodgeId }, include: PLAN_INCLUDE });
    if (!plan || (!staff && plan.memberId !== ownMemberId)) return null;
    return {
      plan,
      letterhead: await getLetterhead(db, lodgeId),
      signatures: await getReportSignatories(db, lodgeId, { at: plan.createdAt }),
    };
  });
  if (!data) notFound();

  const p = presentPlan(data.plan);
  return (
    <ContratoClient
      plan={p}
      memberCpf={data.plan.member.cpf}
      isCandidate={data.plan.member.status === 'candidate'}
      letterhead={data.letterhead}
      signatures={data.signatures}
      issuedBy={session?.user?.name ?? null}
    />
  );
}
