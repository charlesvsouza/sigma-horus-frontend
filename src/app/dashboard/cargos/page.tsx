import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import CargosClient from './CargosClient';

// Server Component: carrega os cargos no servidor (sem fetch-on-mount no
// cliente). O CargosClient recebe a lista por props e usa router.refresh()
// após mutações para re-renderizar com dados frescos.
export default async function CargosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const offices = lodgeId
    ? await withTenant(String(lodgeId), (db) =>
        db.office.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { order: 'asc' } }),
      )
    : [];
  return <CargosClient offices={offices.map((o) => ({ id: o.id, name: o.name, order: o.order }))} />;
}
