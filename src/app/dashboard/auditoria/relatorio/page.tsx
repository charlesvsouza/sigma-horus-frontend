import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AUDIT_REPORT_LIMIT, auditPeriodBounds, buildAuditReport } from '@/lib/audit-report';
import { todayKeyBR } from '@/lib/ledger-day';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccess } from '@/lib/rbac';
import AuditReportClient from './AuditReportClient';

// Relatório de intervenções da Auditoria: o que cada pessoa fez, num período escolhido à mão.
// Mesmo acesso da trilha (Administrador, ou o cargo a quem ele liberar 'Auditoria').
export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; actor?: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId ? String(session.user.lodgeId) : null;
  if (!lodgeId || !(await canLodgeAccess(lodgeId, session?.user?.role, 'audit', 'read'))) redirect('/dashboard');
  const sp = await searchParams;

  const today = todayKeyBR();
  const monthAgo = new Date(`${today}T12:00:00.000Z`);
  monthAgo.setUTCDate(monthAgo.getUTCDate() - 30);
  const from = sp.from ?? monthAgo.toISOString().slice(0, 10);
  const to = sp.to ?? today;
  const actor = sp.actor || '';

  const data = await withTenant(lodgeId, async (db) => {
    const [lodge, users, rows] = await Promise.all([
      db.lodge.findUnique({ where: { id: lodgeId }, select: { name: true, crestUrl: true } }),
      db.user.findMany({ where: { lodgeId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      db.auditLog.findMany({
        where: {
          lodgeId,
          createdAt: auditPeriodBounds(from, to),
          ...(actor ? (actor.startsWith('system') ? { userId: null } : { userId: actor }) : {}),
        },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: AUDIT_REPORT_LIMIT + 1,
      }),
    ]);
    return { lodge, users, rows };
  });

  const truncated = data.rows.length > AUDIT_REPORT_LIMIT;
  const report = buildAuditReport(
    data.rows.slice(0, AUDIT_REPORT_LIMIT).map((r) => ({ ...r, userName: r.user?.name ?? null })),
    actor || null,
  );

  return (
    <AuditReportClient
      lodgeName={data.lodge?.name ?? 'Loja'}
      crestUrl={data.lodge?.crestUrl ?? null}
      issuedBy={session?.user?.name ?? null}
      users={data.users.map((u) => ({ id: u.id, name: u.name }))}
      from={from}
      to={to}
      actor={actor}
      truncated={truncated}
      report={report}
    />
  );
}
