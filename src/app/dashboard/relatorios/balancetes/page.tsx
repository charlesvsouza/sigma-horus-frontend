import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getReportSignatories } from '@/lib/report-signatories';
import BalancetesClient, { type BalanceteLine } from './BalancetesClient';

// Server Component: histórico de balancetes periódicos (trimestral/semestral)
// apresentados em sessão, independente do encerramento do veneralato.
export default async function BalancetesPage() {
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

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Acesso negado.</p>
      </main>
    );
  }

  const { items, currentTerm, lodge, signatoriesById } = await withTenant(String(lodgeId), async (db) => {
    const [items, currentTerm, lodge] = await Promise.all([
      db.balancete.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { periodTo: 'desc' } }),
      db.term.findFirst({
        where: { lodgeId: String(lodgeId), status: { not: 'closed' } },
        orderBy: { startDate: 'desc' },
        select: { startDate: true },
      }),
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
    ]);
    // Quem assina cada balancete é quem estava no cargo no fim daquele período.
    const signatories = await Promise.all(
      items.map((b) => getReportSignatories(db, String(lodgeId), { at: b.periodTo, withFinanceCommittee: true })),
    );
    return { items, currentTerm, lodge, signatoriesById: Object.fromEntries(items.map((b, i) => [b.id, signatories[i]])) };
  });

  const serialized = items.map((b) => ({
    id: b.id,
    periodFrom: b.periodFrom.toISOString(),
    periodTo: b.periodTo.toISOString(),
    totalReceivables: b.totalReceivables,
    totalPayables: b.totalPayables,
    totalPayments: b.totalPayments,
    netBalance: b.netBalance,
    presentedAt: b.presentedAt.toISOString(),
    approved: b.approved,
    approvedAt: b.approvedAt ? b.approvedAt.toISOString() : null,
    notes: b.notes,
    source: b.source,
    detail: Array.isArray(b.detail) ? (b.detail as unknown as BalanceteLine[]) : null,
  }));

  const normalizedRole = (role ?? 'member').toLowerCase();
  const canApprove = normalizedRole === 'venerable' || normalizedRole === 'admin';

  return (
    <BalancetesClient
      items={serialized}
      canApprove={canApprove}
      currentTermStart={currentTerm?.startDate.toISOString() ?? null}
      lodgeName={lodge?.name ?? 'Loja'}
      crestUrl={lodge?.crestUrl ?? null}
      issuedBy={session?.user?.name ?? null}
      signatoriesById={signatoriesById}
    />
  );
}
