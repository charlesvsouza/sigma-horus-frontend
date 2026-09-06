import { auth } from '@/lib/auth';
import { getClosingReport } from '@/lib/closing-report';
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

  const data = await getClosingReport(String(lodgeId), from, to);
  return <FechamentoCompletoClient data={data} initialFrom={from} initialTo={to} />;
}
