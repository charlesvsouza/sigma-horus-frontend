import { auth } from '@/lib/auth';
import { todayBR } from '@/lib/date-only';
import { parseMonth } from '@/lib/dues-punctuality';
import { loadDuesPunctuality } from '@/lib/dues-punctuality-server';
import { canSeePaymentHistory } from '@/lib/payment-history';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { getReportSignatories } from '@/lib/report-signatories';
import PontualidadeClient from './PontualidadeClient';

// Pontualidade das mensalidades de um mês (pagas até o vencimento × após × não pagas). Com nomes: só
// Tesoureiro, Venerável e Administrador (os mesmos do Histórico de pagamentos).
export default async function PontualidadePage(props: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await props.searchParams;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return <main className="min-h-screen px-6 py-10"><p className="text-sm text-sand-dark">Sessão expirada.</p></main>;
  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok || !canSeePaymentHistory(role)) return <main className="min-h-screen px-6 py-10"><p className="text-sm text-sand-dark">Acesso negado.</p></main>;

  const now = new Date();
  const month = parseMonth(sp.mes, todayBR(now).toISOString().slice(0, 10));
  const data = await withTenant(String(lodgeId), async (db) => {
    const [punctuality, lodge, signatures] = await Promise.all([
      loadDuesPunctuality(db, String(lodgeId), month, now),
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
      getReportSignatories(db, String(lodgeId), { by: 'treasurer' }),
    ]);
    return { punctuality, lodge, signatures };
  });

  return (
    <PontualidadeClient
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      issuedBy={session?.user?.name ?? null}
      signatures={data.signatures}
      month={month}
      rows={data.punctuality.rows}
      summary={data.punctuality.summary}
    />
  );
}
