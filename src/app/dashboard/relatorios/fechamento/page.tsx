import { auth } from '@/lib/auth';
import { getClosingReport } from '@/lib/closing-report';
import FechamentoClient from './FechamentoClient';

// Server Component: relatório de fechamento. O período vem da URL (?from&to);
// "Aplicar" no cliente navega pela URL e este componente recarrega os dados.
export default async function FechamentoPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  const from = sp.from ?? `${new Date().getFullYear()}-01-01`;
  const to = sp.to ?? new Date().toISOString().slice(0, 10);

  if (!lodgeId) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Sessão expirada.</p>
      </main>
    );
  }

  const data = await getClosingReport(String(lodgeId), from, to);
  return <FechamentoClient data={data} initialFrom={from} initialTo={to} />;
}
