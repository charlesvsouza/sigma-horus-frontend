import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { lodgeArtOf } from '@/lib/certificate-server';
import { normalizeRole, requireLodgeAccessAny } from '@/lib/rbac';
import { SESSION_TYPE_LABEL } from '@/lib/status-labels';
import CertificadosClient, { type CertSession, type CertVisit } from './CertificadosClient';

// Social → Certificados de presença: sessões já realizadas com visitantes; para a escolhida, os
// visitantes e a situação do certificado de cada um. Emitir/enviar é de quem cuida das sessões.
export default async function CertificadosPage({ searchParams }: { searchParams: Promise<{ sessao?: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  const denied = (text: string) => (
    <main className="min-h-screen px-6 py-10">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return denied('Sessão expirada.');
  const access = await requireLodgeAccessAny(lodgeId, session?.user?.role, ['members', 'attendance'], 'write', session?.user?.memberId);
  if (!access.ok) return denied('Acesso restrito à Secretaria, ao Venerável e ao Administrador.');

  const { sessao } = await searchParams;
  const now = new Date();
  const data = await withTenant(lodgeId, async (db) => {
    const sessions = await db.session.findMany({
      where: { lodgeId, visitors: { some: {} }, date: { lte: now } },
      select: { id: true, title: true, date: true, endDate: true, type: true, _count: { select: { visitors: true } }, visitors: { select: { certificateSentAt: true } } },
      orderBy: { date: 'desc' },
      take: 60,
    });
    const selected = sessions.find((s) => s.id === sessao) ?? sessions[0] ?? null;
    const visits = selected
      ? await db.sessionVisitor.findMany({
          where: { lodgeId, sessionId: selected.id },
          select: {
            id: true, degreeAtVisit: true, certificateNumber: true, certificateSentAt: true, certificateStatus: true,
            visitor: { select: { name: true, email: true, consentAt: true, anonymizedAt: true, degree: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const lodge = await db.lodge.findUnique({ where: { id: lodgeId }, select: { certificateArtKey: true, certificateArtType: true, certificateLayout: true } });
    return { sessions, selected, visits, lodge };
  });
  // Arte enviada × pronta: pronta = arquivo + posições dos campos configuradas.
  const art = { uploaded: Boolean(data.lodge?.certificateArtKey), ready: lodgeArtOf(data.lodge) !== null };

  const sessions: CertSession[] = data.sessions.map((s) => ({
    id: s.id,
    title: s.title,
    date: s.date.toISOString(),
    typeLabel: SESSION_TYPE_LABEL[s.type] ?? s.type,
    ended: (s.endDate ?? s.date).getTime() <= now.getTime(),
    visitors: s._count.visitors,
    sent: s.visitors.filter((v) => v.certificateSentAt).length,
  }));
  const visits: CertVisit[] = data.visits.map((v) => ({
    id: v.id,
    name: v.visitor.name,
    degree: v.degreeAtVisit ?? v.visitor.degree,
    email: v.visitor.email,
    consent: Boolean(v.visitor.consentAt),
    anonymized: Boolean(v.visitor.anonymizedAt),
    number: v.certificateNumber,
    sentAt: v.certificateSentAt ? v.certificateSentAt.toISOString() : null,
    status: v.certificateStatus,
  }));

  return (
    <CertificadosClient
      sessions={sessions}
      selectedId={data.selected?.id ?? null}
      visits={visits}
      art={art}
      canManageArt={normalizeRole(session?.user?.role) === 'admin'}
    />
  );
}
