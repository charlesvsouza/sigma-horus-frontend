import { auth } from '@/lib/auth';
import { declarationNumber, evaluateGoodStanding } from '@/lib/good-standing';
import { loadMemberOpenDebts } from '@/lib/good-standing-server';
import { getLetterhead } from '@/lib/letterhead';
import { degreeShort } from '@/lib/masonic-degree';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getReportSignatories } from '@/lib/report-signatories';
import DeclaracaoClient from '../../relatorios/declaracao-regularidade/DeclaracaoClient';

// O irmão emite a própria declaração de regularidade (só a dele, pelo memberId da sessão).
export default async function Page() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;

  const blocked = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return blocked('Sessão expirada.');
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'portal', 'read');
  if (!access.ok) return blocked('Acesso negado.');
  if (!memberId) return blocked('Este login não está ligado a um cadastro de membro. Entre com o seu login de obreiro para emitir a sua declaração.');

  const data = await withTenant(lodgeId, async (db) => {
    const [letterhead, signatures, member, debts] = await Promise.all([
      getLetterhead(db, lodgeId),
      getReportSignatories(db, lodgeId),
      db.member.findFirst({
        where: { id: memberId, lodgeId },
        select: { id: true, name: true, cpf: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true, currentDegree: true, gradeName: true },
      }),
      loadMemberOpenDebts(db, lodgeId, memberId),
    ]);
    return { letterhead, signatures, member, debts };
  });
  if (!data.member) return blocked('Cadastro de membro não encontrado.');

  const member = { id: data.member.id, name: data.member.name, cpf: data.member.cpf, degree: degreeShort(data.member) };
  return (
    <DeclaracaoClient
      mode="member"
      letterhead={data.letterhead}
      member={member}
      standing={evaluateGoodStanding(data.debts)}
      signatures={data.signatures}
      number={declarationNumber(member.id)}
      issuedBy={member.name}
    />
  );
}
