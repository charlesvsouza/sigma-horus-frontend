import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getBudgetComparison } from '@/lib/budget';
import OrcamentoClient from './OrcamentoClient';

// Server Component: orçamento anual (orçado × realizado) por categoria do
// plano de contas. O ano vem da URL (?year=), "Aplicar" navega e recarrega.
export default async function OrcamentoPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const year = Number(sp.year) || new Date().getFullYear();

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

  const items = await withTenant(String(lodgeId), (db) => getBudgetComparison(db, String(lodgeId), year));
  const canWrite = (await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write')).ok;

  return <OrcamentoClient year={year} items={items} canEdit={canWrite} />;
}
