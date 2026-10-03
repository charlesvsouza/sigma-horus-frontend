import { auth } from '@/lib/auth';
import { NOT_CANDIDATE } from '@/lib/candidate';
import { withTenant } from '@/lib/prisma';
import { sessionDegrees } from '@/lib/session-convocation';
import { minutesDegrees } from '@/lib/session-minutes';
import { loadConvocation } from '@/lib/session-convocation-server';
import SessionDetailClient from './SessionDetailClient';

// Server Component: sessão + membros + presença inicial (sem fetch-on-mount).
export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role ?? '';

  const data = lodgeId
    ? await withTenant(String(lodgeId), async (db) => {
        const item = await db.session.findFirst({
          where: { id, lodgeId: String(lodgeId) },
          include: { attendances: { include: { member: { select: { id: true, name: true } } } }, minutesFiles: { select: { degree: true, fileName: true }, orderBy: { degree: 'asc' } } },
        });
        // Visitantes da sessão (lista digitada pela Secretaria), na ordem em que foram incluídos.
        const visits = await db.sessionVisitor.findMany({
          where: { lodgeId: String(lodgeId), sessionId: id },
          select: {
            id: true, visitorId: true, degreeAtVisit: true, certificateSentAt: true,
            visitor: { select: { name: true, degree: true, lodgeName: true, lodgeNumber: true, orient: true, powerName: true, email: true, phone: true, anonymizedAt: true } },
          },
          orderBy: { createdAt: 'asc' },
        });
        const members = await db.member.findMany({
          where: { lodgeId: String(lodgeId), ...NOT_CANDIDATE },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        });
        return { item, members, visits };
      })
    : { item: null, members: [], visits: [] };

  if (!data.item) {
    return (
      <main className="min-h-screen px-6 py-12">
        <p className="text-sm text-sand-dark">Sessão não encontrada.</p>
      </main>
    );
  }

  // Texto que a convocação teria hoje × o último enviado: acusa sessão alterada depois do envio.
  const convocation = await loadConvocation(String(lodgeId), id);

  const initialAttendance: Record<string, string> = {};
  for (const att of data.item.attendances) initialAttendance[att.member.id] = att.status;

  return (
    <SessionDetailClient
      session={{
        id: data.item.id, title: data.item.title, date: data.item.date.toISOString(),
        endDate: data.item.endDate ? data.item.endDate.toISOString() : null,
        type: data.item.type, degrees: sessionDegrees(data.item),
        agenda: data.item.agenda ?? null,
        minutesDegrees: minutesDegrees(data.item),
        minutesFiles: data.item.minutesFiles,
        convocationSentAt: data.item.convocationSentAt ? data.item.convocationSentAt.toISOString() : null,
        convocationSentText: convocation?.sentText ?? null,
        convocationCurrentText: convocation?.base ?? '',
        convocationChanged: convocation?.changed ?? false,
        locked: data.item.locked,
        lockedAt: data.item.lockedAt ? data.item.lockedAt.toISOString() : null,
      }}
      members={data.members}
      visits={data.visits.map((v) => ({
        visitId: v.id,
        visitorId: v.visitorId,
        name: v.visitor.name,
        degree: v.degreeAtVisit ?? v.visitor.degree,
        lodgeName: v.visitor.lodgeName,
        lodgeNumber: v.visitor.lodgeNumber,
        orient: v.visitor.orient,
        powerName: v.visitor.powerName,
        email: v.visitor.email,
        phone: v.visitor.phone,
        anonymized: Boolean(v.visitor.anonymizedAt),
        certificateSentAt: v.certificateSentAt ? v.certificateSentAt.toISOString() : null,
      }))}
      initialAttendance={initialAttendance}
      role={role}
    />
  );
}
