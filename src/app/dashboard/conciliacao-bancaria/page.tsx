import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import ConciliacaoClient from './ConciliacaoClient';

// Server Component: histórico de linhas de extrato importadas (OFX/CSV).
export default async function ConciliacaoBancariaPage() {
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

  const { items, banks } = await withTenant(String(lodgeId), async (db) => ({
    items: await db.bankTransaction.findMany({
      where: { lodgeId: String(lodgeId) },
      include: { matchedPayment: { select: { id: true, amount: true, paidAt: true, account: { select: { title: true } } } } },
      orderBy: { date: 'desc' },
    }),
    banks: await db.financialAccount.findMany({ where: { lodgeId: String(lodgeId), active: true }, select: { id: true, name: true, isDefault: true }, orderBy: { name: 'asc' } }),
  }));
  const canWrite = (await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write')).ok;

  const serialized = items.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description,
    amount: t.amount,
    status: t.status,
    matchedPayment: t.matchedPayment
      ? { id: t.matchedPayment.id, amount: t.matchedPayment.amount, paidAt: t.matchedPayment.paidAt.toISOString(), accountTitle: t.matchedPayment.account?.title ?? null }
      : null,
  }));

  return <ConciliacaoClient items={serialized} banks={banks} canSettle={canWrite} />;
}
