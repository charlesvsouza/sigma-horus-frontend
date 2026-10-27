import { auth } from '@/lib/auth';
import { partyForSigner } from '@/lib/agreement-signature';
import { canHandleAgreementCharge } from '@/lib/agreement-charge';
import { agreementChargeRows } from '@/lib/agreement-charge-server';
import { BLOCKED_STATUS, canBlockMembers, canCancelAgreement } from '@/lib/member-block';
import { loadMemberDebts, summarizeBlock } from '@/lib/member-block-server';
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
      include: { items: true, member: { select: { id: true, name: true, status: true } }, signatures: { select: { party: true } } },
      orderBy: { blockedAt: 'desc' },
      take: 100,
    });
    // Reconcilia antes de mostrar: um pagamento feito por qualquer caminho pode ter quitado o acordo.
    for (const b of blocks) if (b.status === 'open' || b.status === 'settled') await syncMemberBlock(db, lodgeId, b.memberId);
    const fresh = blocks.length
      ? await db.memberBlock.findMany({ where: { id: { in: blocks.map((b) => b.id) } }, include: { items: true, member: { select: { id: true, name: true, status: true } }, signatures: { select: { party: true } } }, orderBy: { blockedAt: 'desc' } })
      : [];
    const summaries = await Promise.all(fresh.map(async (b) => {
      const s = await summarizeBlock(db, b);
      // Acordo cancelado de irmão que segue bloqueado: as dívidas em aberto ficam à mão (pagar, editar, excluir ou novo acordo).
      const debts = s.status === 'cancelled' && b.member.status === BLOCKED_STATUS ? await loadMemberDebts(db, lodgeId, b.memberId) : [];
      return { b, s, debts, charges: await agreementChargeRows(db, lodgeId, s) };
    }));
    const banks = await db.financialAccount.findMany({ where: { lodgeId, active: true }, select: { id: true, name: true, kind: true, isDefault: true }, orderBy: { name: 'asc' } });
    return { summaries, banks };
  });

  // O acordo cancelado mais recente de um irmão que segue bloqueado fica à vista: dali sai o novo acordo ou a liberação.
  const latestByMember = new Map<string, string>();
  for (const { b } of data.summaries) if (!latestByMember.has(b.memberId)) latestByMember.set(b.memberId, b.id);

  const agreements: AgreementView[] = data.summaries.map(({ b, s, charges, debts }) => ({
    id: s.id,
    debts: debts.map((d) => ({ accountId: d.accountId, title: d.title, balance: Math.round((d.amount - d.paid) * 100) / 100, dueDate: d.dueDate.toISOString() })),
    awaitingNew: s.status === 'cancelled' && latestByMember.get(b.memberId) === b.id && b.member.status === BLOCKED_STATUS,
    signedParties: b.signatures.map((x) => x.party),
    // Em nome de qual parte o usuário logado ainda pode assinar (nenhuma = já assinou, não é parte, ou o acordo acabou).
    canSignAs: (() => { const p = partyForSigner(role, ownMemberId === b.memberId); return p && s.status !== 'lifted' && s.status !== 'cancelled' && !b.signatures.some((x) => x.party === p) ? p : null; })(),
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

  return <AcordosClient agreements={agreements} banks={data.banks} canPay={canPay} canCharge={canHandleAgreementCharge(role)} mayLift={canBlockMembers(role)} mayCancel={canCancelAgreement(role)} />;
}
