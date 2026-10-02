import { auth } from '@/lib/auth';
import { CANDIDATE_STATUS, deriveStage } from '@/lib/candidate';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccess } from '@/lib/rbac';
import CandidatosClient, { type CandidateRow } from './CandidatosClient';

// Secretaria → Candidatos: profanos em processo de admissão (pré-proposta →
// iniciação). Iniciados continuam listados (aba "Iniciados") como histórico
// do processo — o cadastro deles já é de obreiro, em Membros.
export default async function CandidatosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const denied = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return denied('Sessão expirada.');
  // Sindicância e pareceres são sigilosos: só quem edita membros (Administrador, Venerável, Secretário).
  if (!(await canLodgeAccess(lodgeId, session?.user?.role, 'members', 'write'))) return denied('Acesso restrito ao Administrador, ao Venerável e à Secretaria.');

  const { candidates, brothers } = await withTenant(lodgeId, async (db) => ({
    candidates: await db.member.findMany({
      where: { lodgeId, candidateProcess: { isNot: null } },
      select: {
        id: true, name: true, email: true, phone: true, status: true,
        user: { select: { status: true } },
        candidateProcess: {
          select: {
            admissionKind: true, preProposalDate: true, proposalReadingDate: true, inquiryOpenedAt: true, inquiryClosedAt: true, inquiryResult: true,
            ballotDate: true, ballotResult: true, potencyApprovedAt: true, initiationScheduledAt: true, initiatedAt: true,
            closedAt: true, closedReason: true, createdAt: true,
            proposer: { select: { name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    brothers: await db.member.findMany({ where: { lodgeId, status: 'active' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  }));

  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
  const rows: CandidateRow[] = candidates.flatMap((c) => {
    const p = c.candidateProcess;
    if (!p) return [];
    const info = deriveStage(p);
    return [{
      id: c.id,
      name: c.name,
      contact: [c.email, c.phone].filter(Boolean).join(' · '),
      isCandidate: c.status === CANDIDATE_STATUS,
      stage: info.stage,
      admissionKind: p.admissionKind,
      stageIndex: info.index,
      warning: info.warning,
      proposer: p.proposer?.name ?? null,
      closedReason: p.closedReason,
      hasAccess: c.user?.status === 'active',
      since: iso(p.preProposalDate) ?? iso(p.createdAt)!,
      initiationScheduledAt: iso(p.initiationScheduledAt),
      initiatedAt: iso(p.initiatedAt),
    }];
  });

  return <CandidatosClient rows={rows} brothers={brothers} />;
}
