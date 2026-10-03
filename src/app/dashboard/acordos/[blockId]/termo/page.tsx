import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AGREEMENT_PARTIES, partyForSigner } from '@/lib/agreement-signature';
import { getLetterhead } from '@/lib/letterhead';
import { buildInstallments } from '@/lib/member-block';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import TermoAcordoClient from './TermoAcordoClient';

// Termo de acordo de regularização (para assinar digitalmente e arquivar). Abre para a Tesouraria/gestão e
// para o próprio irmão do acordo (pelo portal). Cada parte assina com um clique: a marca fica gravada
// (quem, quando, hash do acordo e código de verificação).
export default async function TermoAcordoPage({ params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId) notFound();
  const role = session?.user?.role;
  const ownMemberId = session?.user?.memberId ? String(session.user.memberId) : null;
  const staff = (await requireLodgeAccess(lodgeId, role, 'accounts', 'read')).ok;

  const data = await withTenant(lodgeId, async (db) => {
    const block = await db.memberBlock.findFirst({
      where: { id: blockId, lodgeId },
      include: { items: true, member: { select: { id: true, name: true } }, signatures: true },
    });
    if (!block || (!staff && block.memberId !== ownMemberId)) return null;
    return { block, letterhead: await getLetterhead(db, lodgeId) };
  });
  if (!data) notFound();

  const { block } = data;
  const mySide = partyForSigner(role, ownMemberId === block.memberId);
  const schedule = buildInstallments(Number(block.total), block.installments, block.firstDueDate);
  const sigByParty = new Map(block.signatures.map((s) => [s.party, s]));

  return (
    <TermoAcordoClient
      letterhead={data.letterhead}
      memberId={block.memberId}
      memberName={block.member.name}
      status={block.status}
      blockedAt={block.blockedAt.toISOString()}
      powerProtocol={block.powerProtocol}
      powerSentAt={block.powerSentAt?.toISOString() ?? null}
      total={Number(block.total)}
      installments={block.installments}
      items={[...block.items].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ id: i.id, kind: i.kind, title: i.title, openAmount: Number(i.openAmount) }))}
      schedule={schedule.map((p) => ({ number: p.number, dueDate: p.dueDate.toISOString(), amount: p.amount }))}
      parties={AGREEMENT_PARTIES.map((p) => {
        const sig = sigByParty.get(p.party);
        return {
          party: p.party,
          label: p.label,
          name: sig?.signerName ?? (p.party === 'member' ? block.member.name : null),
          signedAt: sig?.signedAt.toISOString() ?? null,
          code: sig?.code ?? null,
        };
      })}
      canSignAs={mySide && block.status !== 'lifted' && !sigByParty.has(mySide) ? mySide : null}
      issuedBy={session?.user?.name ?? null}
    />
  );
}
