import { auth } from '@/lib/auth';
import { declarationNumber, evaluateGoodStanding } from '@/lib/good-standing';
import { loadMemberOpenDebts } from '@/lib/good-standing-server';
import { getLetterhead } from '@/lib/letterhead';
import { degreeShort } from '@/lib/masonic-degree';
import { canSeePaymentHistory } from '@/lib/payment-history';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getReportSignatories } from '@/lib/report-signatories';
import DeclaracaoClient from './DeclaracaoClient';

// Declaração de regularidade financeira emitida pela loja — mesmos papéis do Histórico de
// pagamentos (Tesoureiro, Administrador, Venerável): expõe a situação financeira do irmão.
export default async function Page({ searchParams }: { searchParams: Promise<{ memberId?: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const role = session?.user?.role;
  const { memberId } = await searchParams;

  const denied = (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">Acesso restrito ao Tesoureiro, ao Administrador e ao Venerável Mestre. A sua declaração está em Meu portal.</p>
    </main>
  );
  if (!lodgeId || !canSeePaymentHistory(role)) return denied;
  const access = await requireLodgeAccess(lodgeId, role, 'accounts', 'read');
  if (!access.ok) return denied;

  const data = await withTenant(lodgeId, async (db) => {
    const [letterhead, members, signatures] = await Promise.all([
      getLetterhead(db, lodgeId),
      db.member.findMany({ where: { lodgeId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      getReportSignatories(db, lodgeId),
    ]);
    const member = memberId
      ? await db.member.findFirst({
          where: { id: memberId, lodgeId },
          select: { id: true, name: true, cpf: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true, currentDegree: true, gradeName: true },
        })
      : null;
    const debts = member ? await loadMemberOpenDebts(db, lodgeId, member.id) : [];
    return { letterhead, members, signatures, member, debts };
  });

  const member = data.member ? { id: data.member.id, name: data.member.name, cpf: data.member.cpf, degree: degreeShort(data.member) } : null;

  return (
    <DeclaracaoClient
      mode="staff"
      letterhead={data.letterhead}
      members={data.members}
      member={member}
      standing={member ? evaluateGoodStanding(data.debts) : null}
      signatures={data.signatures}
      number={member ? declarationNumber(member.id) : null}
      issuedBy={session?.user?.name ?? null}
    />
  );
}
