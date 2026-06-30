import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import CadastrosClient from './CadastrosClient';

// Server Component: ritos + potências + plano de contas no servidor.
export default async function CadastrosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        rites: await db.rite.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { order: 'asc' } }),
        powers: await db.power.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { order: 'asc' } }),
        chartAccounts: await db.chartAccount.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { code: 'asc' } }),
      }))
    : { rites: [], powers: [], chartAccounts: [] };

  const rites = data.rites.map((r) => ({ id: r.id, name: r.name, order: r.order }));
  const powers = data.powers.map((p) => ({ id: p.id, name: p.name, order: p.order }));
  const chartAccounts = data.chartAccounts.map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.type, category: c.category ?? null }));

  return <CadastrosClient rites={rites} powers={powers} chartAccounts={chartAccounts} />;
}
