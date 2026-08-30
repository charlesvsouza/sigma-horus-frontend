import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import PatrimonioClient from './PatrimonioClient';

// Server Component: carrega o inventário de bens + plano de contas no servidor.
export default async function PatrimonioPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => ({
        assets: await db.asset.findMany({
          where: { lodgeId: String(lodgeId) },
          include: { chartAccount: { select: { id: true, code: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        chartAccounts: await db.chartAccount.findMany({
          where: { lodgeId: String(lodgeId), type: 'EXPENSE' },
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        }),
      }))
    : { assets: [], chartAccounts: [] };

  const assets = data.assets.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    acquisitionDate: a.acquisitionDate ? a.acquisitionDate.toISOString() : null,
    acquisitionValue: Number(a.acquisitionValue),
    currentValue: a.currentValue != null ? Number(a.currentValue) : null,
    status: a.status,
    notes: a.notes,
    chartAccount: a.chartAccount ? { id: a.chartAccount.id, code: a.chartAccount.code, name: a.chartAccount.name } : null,
  }));

  return <PatrimonioClient assets={assets} chartAccounts={data.chartAccounts} />;
}
