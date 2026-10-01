import { auth } from '@/lib/auth';
import { buildPaymentHistory, parsePaymentHistorySort, canSeePaymentHistory, defaultPeriod, periodBounds } from '@/lib/payment-history';
import { loadPaymentHistory } from '@/lib/payment-history-server';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import HistoricoPagamentosClient from './HistoricoPagamentosClient';

// Histórico de pagamentos de todos os irmãos — só Tesoureiro, Administrador e Venerável
// (o Secretário fica de fora por decisão do dono). O irmão vê o dele em Meu portal.
export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; memberId?: string; sort?: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const role = session?.user?.role;
  const sp = await searchParams;

  const denied = (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">Acesso restrito ao Tesoureiro, ao Administrador e ao Venerável Mestre. O seu histórico está em Meu portal.</p>
    </main>
  );
  if (!lodgeId || !canSeePaymentHistory(role)) return denied;
  const access = await requireLodgeAccess(lodgeId, role, 'accounts', 'read');
  if (!access.ok) return denied;

  const def = defaultPeriod();
  const from = sp.from ?? def.from;
  const to = sp.to ?? def.to;
  const memberId = sp.memberId || null;

  const data = await withTenant(lodgeId, async (db) => {
    const [lodge, members, rows] = await Promise.all([
      db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true, crestUrl: true } }),
      db.member.findMany({ where: { lodgeId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      loadPaymentHistory(db, lodgeId, memberId),
    ]);
    return { lodge, members, rows };
  });

  const sort = parsePaymentHistorySort(sp.sort);
  const report = buildPaymentHistory(data.rows, { ...periodBounds(from, to), memberId, sort });

  return (
    <HistoricoPagamentosClient
      mode="staff"
      basePath="/dashboard/relatorios/historico-pagamentos"
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      issuedBy={session?.user?.name ?? null}
      members={data.members}
      from={from}
      to={to}
      memberId={memberId ?? ''}
      memberName={memberId ? data.members.find((m) => m.id === memberId)?.name ?? null : null}
      sort={sort}
      report={report}
    />
  );
}
