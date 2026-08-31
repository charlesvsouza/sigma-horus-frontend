import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import BalancetesClient from './BalancetesClient';

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

  const [items, currentTerm] = await withTenant(String(lodgeId), (db) =>
    Promise.all([
      db.balancete.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { periodTo: 'desc' } }),
      db.term.findFirst({
        where: { lodgeId: String(lodgeId), status: { not: 'closed' } },
        orderBy: { startDate: 'desc' },
        select: { startDate: true },
      }),
    ]),
  );

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
  }));

  const normalizedRole = (role ?? 'member').toLowerCase();
  const canApprove = normalizedRole === 'venerable' || normalizedRole === 'admin';

  return (
    <BalancetesClient
      items={serialized}
      canApprove={canApprove}
      currentTermStart={currentTerm?.startDate.toISOString() ?? null}
    />
  );
}
