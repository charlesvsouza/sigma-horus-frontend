import { auth } from '@/lib/auth';
import { requireLodgeAccess } from '@/lib/rbac';
import { getClosingReport } from '@/lib/closing-report';
import { withTenant } from '@/lib/prisma';
import { getReportSignatories } from '@/lib/report-signatories';
import FechamentoCompletoClient from './FechamentoCompletoClient';

export default async function FechamentoCompletoPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const from = sp.from ?? `${new Date().getFullYear()}-01-01`;
  const to = sp.to ?? new Date().toISOString().slice(0, 10);

  if (!lodgeId) {
    return <main className="min-h-screen px-6 py-12"><p className="text-sand-dark">Sessão inválida.</p></main>;
  }

  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'read');
  if (!access.ok) {
    return <main className="min-h-screen px-6 py-12"><p className="text-sand-dark">Acesso negado.</p></main>;
  }

  const [data, signatures] = await Promise.all([
    getClosingReport(String(lodgeId), from, to),
    withTenant(String(lodgeId), (db) => getReportSignatories(db, String(lodgeId), { at: new Date(`${to}T12:00:00Z`), withFinanceCommittee: true })),
  ]);
  return (
    <FechamentoCompletoClient
      data={data}
      initialFrom={from}
      initialTo={to}
      issuedBy={session?.user?.name ?? null}
      signatures={signatures}
    />
  );
}
