import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccessFor, requireLodgeAccessAny } from '@/lib/rbac';
import VisitantesClient, { type VisitorRow } from './VisitantesClient';

// Secretaria → Visitantes: o cadastro geral dos irmãos visitantes, com o histórico de visitas
// e dos certificados. Quem foi removido a pedido (LGPD) não aparece — só conta nas sessões.
export default async function VisitantesPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const denied = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return denied('Sessão expirada.');
  const access = await requireLodgeAccessAny(lodgeId, session?.user?.role, ['members', 'attendance'], 'read', session?.user?.memberId);
  if (!access.ok) return denied('Acesso restrito à Secretaria e à Chancelaria.');
  const who = { lodgeId, role: session?.user?.role, memberId: session?.user?.memberId };
  const canEdit = (await canLodgeAccessFor(who, 'members', 'write')) || (await canLodgeAccessFor(who, 'attendance', 'write'));

  const { visitors, removed } = await withTenant(lodgeId, async (db) => ({
    visitors: await db.visitor.findMany({
      where: { lodgeId, anonymizedAt: null },
      select: {
        id: true, name: true, degree: true, lodgeName: true, lodgeNumber: true, orient: true, powerName: true, cim: true, phone: true, email: true, consentAt: true,
        visits: {
          select: { id: true, degreeAtVisit: true, certificateSentAt: true, session: { select: { id: true, title: true, date: true } } },
          orderBy: { session: { date: 'desc' } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    removed: await db.visitor.count({ where: { lodgeId, anonymizedAt: { not: null } } }),
  }));

  const rows: VisitorRow[] = visitors.map((v) => ({
    id: v.id,
    name: v.name,
    degree: v.degree,
    lodgeName: v.lodgeName,
    lodgeNumber: v.lodgeNumber,
    orient: v.orient,
    powerName: v.powerName,
    cim: v.cim,
    phone: v.phone,
    email: v.email,
    consent: Boolean(v.consentAt),
    visits: v.visits.map((x) => ({
      id: x.id,
      sessionId: x.session.id,
      title: x.session.title,
      date: x.session.date.toISOString(),
      degree: x.degreeAtVisit,
      certificateSentAt: x.certificateSentAt ? x.certificateSentAt.toISOString() : null,
    })),
  }));

  return <VisitantesClient rows={rows} removed={removed} canEdit={canEdit} />;
}
