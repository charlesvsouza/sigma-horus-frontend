import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import SessionDetailClient from './SessionDetailClient';

// Server Component: sessão + membros + presença inicial (sem fetch-on-mount).
export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => {
        const item = await db.session.findFirst({
          where: { id, lodgeId: String(lodgeId) },
          include: { attendances: { include: { member: { select: { id: true, name: true } } } } },
        });
        const members = await db.member.findMany({
          where: { lodgeId: String(lodgeId) },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        });
        return { item, members };
      })
    : { item: null, members: [] };

  if (!data.item) {
    return (
      <main className="min-h-screen px-6 py-12">
        <p className="text-sm text-sand-dark">Sessão não encontrada.</p>
      </main>
    );
  }

  const initialAttendance: Record<string, string> = {};
  for (const att of data.item.attendances) initialAttendance[att.member.id] = att.status;

  return (
    <SessionDetailClient
      session={{ id: data.item.id, title: data.item.title, date: data.item.date.toISOString(), type: data.item.type, grade: data.item.grade ?? null }}
      members={data.members}
      initialAttendance={initialAttendance}
    />
  );
}
