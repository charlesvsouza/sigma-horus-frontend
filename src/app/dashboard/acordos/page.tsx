import { auth } from '@/lib/auth';
import { partyForSigner } from '@/lib/agreement-signature';
import { canHandleAgreementCharge } from '@/lib/agreement-charge';
import { agreementChargeRows } from '@/lib/agreement-charge-server';
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
  // Registram o pagamento do acordo: Tesoureiro/Administrador (accounts:write) e o Venerável.
  const canPay = (await requireLodgeAccess(lodgeId, role, 'accounts', 'write')).ok || canBlockMembers(role);
  const ownMemberId = session?.user?.memberId ? String(session.user.memberId) : null;

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
    const summaries = await Promise.all(fresh.map(async (b) => {
      const s = await summarizeBlock(db, b);
      return { b, s, charges: await agreementChargeRows(db, lodgeId, s) };
    }));
    const banks = await db.financialAccount.findMany({ where: { lodgeId, active: true }, select: { id: true, name: true, kind: true, isDefault: true }, orderBy: { name: 'asc' } });
    return { summaries, banks };
  });

  const agreements: AgreementView[] = data.summaries.map(({ b, s, charges }) => ({
    id: s.id,
    signedParties: b.signatures.map((x) => x.party),
    // Em nome de qual parte o usuário logado ainda pode assinar (nenhuma = já assinou, não é parte, ou o acordo acabou).
    canSignAs: (() => { const p = partyForSigner(role, ownMemberId === b.memberId); return p && s.status !== 'lifted' && !b.signatures.some((x) => x.party === p) ? p : null; })(),
    memberId: s.memberId,
    kind: s.kind,
    charges,
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

  return <AcordosClient agreements={agreements} banks={data.banks} canPay={canPay} canCharge={canHandleAgreementCharge(role)} mayLift={canBlockMembers(role)} />;
}
