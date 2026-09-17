import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { computeAttendanceReport } from '@/lib/attendance-report';
import FrequenciaClient from './FrequenciaClient';

export default async function FrequenciaPage(props: { searchParams: Promise<{ from?: string; to?: string }> }) {
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

  const access = await requireLodgeAccess(String(lodgeId), role, 'members', 'read');
  if (!access.ok) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-sand-dark">Acesso negado.</p>
      </main>
    );
  }

  const now = new Date();
  const from = searchParams.from ? new Date(`${searchParams.from}T00:00:00`) : new Date(now.getFullYear(), 0, 1);
  const to = searchParams.to ? new Date(`${searchParams.to}T23:59:59`) : now;

  const data = await withTenant(String(lodgeId), async (db) => {
    const [lodge, members, sessions, attendances] = await Promise.all([
      db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { name: true, crestUrl: true } }),
      db.member.findMany({ where: { lodgeId: String(lodgeId), status: 'active' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      db.session.findMany({ where: { lodgeId: String(lodgeId) }, select: { id: true, title: true, date: true, type: true } }),
      db.attendance.findMany({ where: { lodgeId: String(lodgeId) }, select: { sessionId: true, memberId: true, status: true } }),
    ]);
    return { lodge, members, sessions, attendances };
  });

  const report = computeAttendanceReport(data.members, data.sessions, data.attendances, from, to);

  return (
    <FrequenciaClient
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      from={from.toISOString().slice(0, 10)}
      to={searchParams.to ?? now.toISOString().slice(0, 10)}
      report={report}
    />
  );
}
