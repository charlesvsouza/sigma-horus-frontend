import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getLodgeOverdueDuesReport } from '@/lib/overdue';
import InadimplenciaClient from './InadimplenciaClient';

// Server Component: relatório de mensalidades em aberto por membro, usado para
// identificar quem está enquadrado (ou próximo) do Art. 002 (60 dias).
export default async function InadimplenciaPage() {
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

  const rows = await withTenant(String(lodgeId), (db) => getLodgeOverdueDuesReport(db, String(lodgeId)));

  const serialized = rows.map((r) => ({ ...r, oldestDueDate: r.oldestDueDate.toISOString() }));
  return <InadimplenciaClient rows={serialized} />;
}
