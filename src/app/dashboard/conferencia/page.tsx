import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { normalizeRole, requireLodgeAccess } from '@/lib/rbac';
import { todayKeyBR } from '@/lib/ledger-day';
import { balancesAsOf, loadLedgerStatus } from '@/lib/ledger-lock-server';
import ConferenciaClient from './ConferenciaClient';

// Conferência do livro com o banco: trava o caixa até um dia conferido; retificação só com a ciência do Venerável.
export default async function ConferenciaPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Sessão expirada.</p>
      </main>
    );
  }
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'read');
  if (!access.ok) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Acesso negado.</p>
      </main>
    );
  }

  const role = normalizeRole(session?.user?.role);
  const data = await withTenant(String(lodgeId), async (db) => {
    const status = await loadLedgerStatus(db, String(lodgeId));
    const rectifications = await db.ledgerRectification.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { requestedAt: 'desc' }, take: 30 });
    // Contas que precisam do saldo do banco: as ativas e as inativas que ainda têm saldo, no dia de ontem.
    const yesterday = new Date(new Date(`${todayKeyBR()}T00:00:00.000Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
    const accounts = (await balancesAsOf(db, String(lodgeId), yesterday)).filter((a) => a.active || a.calculated !== 0).map((a) => ({ id: a.accountId, name: a.name }));
    return { status, rectifications, accounts, yesterday };
  });

  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return (
    <ConferenciaClient
      role={role}
      userId={String(session?.user?.id ?? '')}
      defaultDate={data.yesterday}
      accounts={data.accounts}
      checkpoint={
        data.status.checkpoint
          ? { throughDate: data.status.checkpoint.throughKey, confirmedByName: data.status.checkpoint.confirmedByName, createdAt: data.status.checkpoint.createdAt.toISOString(), balances: data.status.checkpoint.balances }
          : null
      }
      drift={data.status.drift}
      rectificationOpen={data.status.rectificationOpen}
      rectifications={data.rectifications.map((r) => ({
        id: r.id, status: r.status, reason: r.reason, dateFrom: r.dateFrom.toISOString().slice(0, 10), dateTo: r.dateTo.toISOString().slice(0, 10),
        requestedById: r.requestedById, requestedByName: r.requestedByName, requestedAt: r.requestedAt.toISOString(),
        decidedByName: r.decidedByName, decidedAt: iso(r.decidedAt), decisionNote: r.decisionNote, selfApproved: r.selfApproved,
        expiresAt: iso(r.expiresAt), usedCount: r.usedCount, lastUsedAt: iso(r.lastUsedAt),
      }))}
    />
  );
}
