import { auth } from '@/lib/auth';
import { canBlockMembers } from '@/lib/member-block';
import { summarizeBlock } from '@/lib/member-block-server';
import { syncMemberBlock } from '@/lib/member-block-sync';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import AcordosClient, { type AgreementView } from './AcordosClient';

// Tesouraria → Acordos de regularização: irmãos bloqueados por comunicado à Potência (Art. 002), o
// acordo de cada um (dívidas + taxa de regularização), as parcelas e o retorno. Ver lib/member-block.ts.
export default async function AcordosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const denied = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return denied('Sessão expirada.');
  const role = session?.user?.role;
  const access = await requireLodgeAccess(lodgeId, role, 'accounts', 'read');
  if (!access.ok) return denied('Acesso negado.');
  const canPay = (await requireLodgeAccess(lodgeId, role, 'accounts', 'write')).ok;

  const data = await withTenant(lodgeId, async (db) => {
    const blocks = await db.memberBlock.findMany({
      where: { lodgeId },
      include: { items: true, member: { select: { id: true, name: true } }, signatures: { select: { party: true } } },
      orderBy: { blockedAt: 'desc' },
      take: 100,
    });
    // Reconcilia antes de mostrar: um pagamento feito por qualquer caminho pode ter quitado o acordo.
    for (const b of blocks) if (b.status !== 'lifted') await syncMemberBlock(db, lodgeId, b.memberId);
    const fresh = blocks.length
      ? await db.memberBlock.findMany({ where: { id: { in: blocks.map((b) => b.id) } }, include: { items: true, member: { select: { id: true, name: true } }, signatures: { select: { party: true } } }, orderBy: { blockedAt: 'desc' } })
      : [];
    const summaries = await Promise.all(fresh.map(async (b) => ({ b, s: await summarizeBlock(db, b) })));
    const banks = await db.financialAccount.findMany({ where: { lodgeId, active: true }, select: { id: true, name: true, kind: true, isDefault: true }, orderBy: { name: 'asc' } });
    return { summaries, banks };
  });

  const agreements: AgreementView[] = data.summaries.map(({ b, s }) => ({
    id: s.id,
    signedParties: b.signatures.map((x) => x.party),
    memberId: s.memberId,
    memberName: b.member.name,
    status: s.status,
    blockedAt: s.blockedAt.toISOString(),
    powerProtocol: s.powerProtocol,
    powerSentAt: s.powerSentAt?.toISOString() ?? null,
    note: s.note,
    overdueDaysAtBlock: s.overdueDaysAtBlock,
    total: s.total,
    paid: s.paid,
    remaining: s.remaining,
    installments: s.installments,
    brokenAt: s.brokenAt?.toISOString() ?? null,
    settledAt: s.settledAt?.toISOString() ?? null,
    liftedAt: s.liftedAt?.toISOString() ?? null,
    items: s.items.map((i) => ({ id: i.id, kind: i.kind, title: i.title, openAmount: i.openAmount, remaining: i.remaining })),
    schedule: s.schedule.map((p) => ({ number: p.number, dueDate: p.dueDate.toISOString(), amount: p.amount, covered: p.covered, late: p.late })),
  }));

  return <AcordosClient agreements={agreements} banks={data.banks} canPay={canPay} mayLift={canBlockMembers(role)} />;
}
