import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { groupPaymentsByChartAccount, compareDre, type DrePaymentInput } from '@/lib/dre';
import DreClient from './DreClient';

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Período B (comparação) a partir do período A: mesma duração imediatamente
// antes ("período anterior equivalente"), ou o mesmo intervalo um ano antes
// ("mesmo período do ano anterior") — evita o usuário ter que digitar duas
// datas na mão pra comparar (reduz cliques).
function computePeriodB(from: Date, to: Date, mode: 'previous' | 'yoy'): { from: Date; to: Date } {
  if (mode === 'yoy') {
    const bFrom = new Date(from); bFrom.setFullYear(bFrom.getFullYear() - 1);
    const bTo = new Date(to); bTo.setFullYear(bTo.getFullYear() - 1);
    return { from: bFrom, to: bTo };
  }
  const durationMs = to.getTime() - from.getTime();
  const bTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const bFrom = new Date(bTo.getTime() - durationMs);
  return { from: bFrom, to: bTo };
}

export default async function DrePage(props: { searchParams: Promise<{ from?: string; to?: string; compare?: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const searchParams = await props.searchParams;

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

  const now = new Date();
  const from = searchParams.from ? new Date(`${searchParams.from}T00:00:00`) : monthStart(now);
  const to = searchParams.to ? new Date(`${searchParams.to}T23:59:59`) : now;
  const compareMode: 'previous' | 'yoy' = searchParams.compare === 'yoy' ? 'yoy' : 'previous';
  const periodB = computePeriodB(from, to, compareMode);

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, activeTerm, payments] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
      db.term.findFirst({ where: { lodgeId: String(lodgeId), status: 'active' }, select: { startDate: true } }),
      db.payment.findMany({
        where: { lodgeId: String(lodgeId) },
        select: {
          amount: true,
          paidAt: true,
          account: { select: { type: true, title: true, chartAccount: { select: { code: true, name: true, category: true } } } },
        },
      }),
    ]);
    return { lodge, activeTerm, payments };
  });

  const paymentInputs: DrePaymentInput[] = data.payments.map((p) => ({
    amount: Number(p.amount),
    paidAt: p.paidAt,
    accountType: p.account?.type ?? null,
    chartAccount: p.account?.chartAccount ?? null,
    accountTitle: p.account?.title ?? null,
  }));

  const rowsA = groupPaymentsByChartAccount(paymentInputs, from, to);
  const rowsB = groupPaymentsByChartAccount(paymentInputs, periodB.from, periodB.to);
  const comparison = compareDre(rowsA, rowsB);

  return (
    <DreClient
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      from={from.toISOString().slice(0, 10)}
      to={searchParams.to ?? now.toISOString().slice(0, 10)}
      compareMode={compareMode}
      periodBFrom={periodB.from.toISOString().slice(0, 10)}
      periodBTo={periodB.to.toISOString().slice(0, 10)}
      activeTermStart={data.activeTerm?.startDate.toISOString().slice(0, 10) ?? null}
      comparison={comparison}
    />
  );
}
