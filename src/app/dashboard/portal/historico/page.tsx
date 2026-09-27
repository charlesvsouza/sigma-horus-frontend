import { auth } from '@/lib/auth';
import { buildPaymentHistory, defaultPeriod, periodBounds } from '@/lib/payment-history';
import { loadPaymentHistory } from '@/lib/payment-history-server';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import HistoricoPagamentosClient from '../../relatorios/historico-pagamentos/HistoricoPagamentosClient';

// "Meu histórico de pagamentos": o irmão vê tudo o que já pagou à loja, com o recibo de
// cada pagamento — sem depender do que a Tesouraria informa. Só o próprio (memberId da sessão).
export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const memberId = session?.user?.memberId ? String(session.user.memberId) : null;
  const sp = await searchParams;

  const blocked = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return blocked('Sessão expirada.');
  const access = await requireLodgeAccess(lodgeId, session?.user?.role, 'portal', 'read');
  if (!access.ok) return blocked('Acesso negado.');
  if (!memberId) return blocked('Este login não está ligado a um cadastro de membro. Entre com o seu login de obreiro para ver o seu histórico.');

  const def = defaultPeriod();
  const from = sp.from ?? def.from;
  const to = sp.to ?? def.to;

  const data = await withTenant(lodgeId, async (db) => {
    const [lodge, member, rows] = await Promise.all([
      db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true, crestUrl: true } }),
      db.member.findFirst({ where: { id: memberId, lodgeId }, select: { name: true } }),
      loadPaymentHistory(db, lodgeId, memberId),
    ]);
    return { lodge, member, rows };
  });
  if (!data.member) return blocked('Cadastro de membro não encontrado.');

  const report = buildPaymentHistory(data.rows, { ...periodBounds(from, to), memberId });

  return (
    <HistoricoPagamentosClient
      mode="member"
      basePath="/dashboard/portal/historico"
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      issuedBy={data.member.name}
      from={from}
      to={to}
      memberName={data.member.name}
      report={report}
    />
  );
}
