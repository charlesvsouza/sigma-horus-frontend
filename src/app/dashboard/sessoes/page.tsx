import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import SessoesClient from './SessoesClient';

// Server Component: carrega as sessões no servidor (sem fetch-on-mount).
export default async function SessoesPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const items = lodgeId
    ? await withTenant(String(lodgeId), (db) =>
        db.session.findMany({
          where: { lodgeId: String(lodgeId) },
          include: { _count: { select: { attendances: true } } },
          orderBy: { date: 'desc' },
        }),
      )
    : [];
  const sessions = items.map((s) => ({
    id: s.id,
    title: s.title,
    date: s.date.toISOString(),
    type: s.type,
    grade: s.grade ?? null,
    notes: s.notes ?? null,
    _count: { attendances: s._count.attendances },
  }));
  return <SessoesClient sessions={sessions} />;
}
