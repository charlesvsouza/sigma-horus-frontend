// Carrega os números dos avisos do menu lateral. Falha em silêncio (menu sem números é melhor que menu quebrado).
import { ASAAS_CASH_CONFIRMED_ENTITY, ASAAS_CASH_PENDING_ENTITY } from '@/lib/asaas-cash';
import { todayBR } from '@/lib/date-only';
import { badge, pendingNoticeAccountIds, pendingWithoutConfirmation, plural, type NavBadge } from '@/lib/nav-badges';
import { DUES_ACCOUNT_WHERE } from '@/lib/overdue';
import { PAYMENT_NOTICE_ENTITY, PAYMENT_NOTICE_REJECT_ENTITY } from '@/lib/portal-dues';
import { withTenant } from '@/lib/prisma';

const SIXTY_DAYS = 60 * 86_400_000;

/** Avisos por endereço do menu, só para o que o papel enxerga. */
export async function loadNavBadges(lodgeId: string, role: string): Promise<Record<string, NavBadge>> {
  const treasury = ['admin', 'venerable', 'treasurer'].includes(role);
  const cashier = ['admin', 'treasurer'].includes(role);
  const admission = ['admin', 'venerable', 'secretary'].includes(role);
  if (!treasury && !admission) return {};
  try {
    const since = new Date(Date.now() - SIXTY_DAYS);
    const today = todayBR();
    const out: Record<string, NavBadge> = {};
    await withTenant(lodgeId, async (db) => {
      const [notices, rejections, cashPending, cashConfirmed, overdue, approvals, candidates] = await Promise.all([
        cashier ? db.auditLog.findMany({ where: { lodgeId, entity: PAYMENT_NOTICE_ENTITY, createdAt: { gte: since } }, select: { entityId: true, createdAt: true }, take: 2000 }) : [],
        cashier ? db.auditLog.findMany({ where: { lodgeId, entity: PAYMENT_NOTICE_REJECT_ENTITY, createdAt: { gte: since } }, select: { entityId: true, createdAt: true }, take: 2000 }) : [],
        cashier ? db.auditLog.findMany({ where: { lodgeId, entity: ASAAS_CASH_PENDING_ENTITY, createdAt: { gte: since } }, select: { entityId: true }, take: 500 }) : [],
        cashier ? db.auditLog.findMany({ where: { lodgeId, entity: ASAAS_CASH_CONFIRMED_ENTITY, createdAt: { gte: since } }, select: { entityId: true }, take: 500 }) : [],
        treasury
          ? db.account.findMany({
              where: { lodgeId, type: 'RECEIVABLE', ...DUES_ACCOUNT_WHERE, status: { not: 'paid' }, memberId: { not: null }, dueDate: { lt: today } },
              distinct: ['memberId'],
              select: { memberId: true },
            })
          : [],
        treasury ? db.account.count({ where: { lodgeId, type: 'PAYABLE', approvalStatus: 'pending', status: { not: 'paid' } } }) : 0,
        admission ? db.candidateProcess.count({ where: { lodgeId, closedAt: null, initiatedAt: null } }) : 0,
      ]);

      if (cashier) {
        // Aviso só conta enquanto a conta ainda está em aberto.
        const noticeIds = pendingNoticeAccountIds(notices, rejections);
        const open = noticeIds.length
          ? await db.account.count({ where: { lodgeId, id: { in: noticeIds }, status: { not: 'paid' } } })
          : 0;
        const cash = pendingWithoutConfirmation(cashPending, cashConfirmed).length;
        const total = open + cash;
        const b = badge(total, 'atencao', (n) => `${plural(n, 'pagamento', 'pagamentos')} esperando conferência`);
        if (b) out['/dashboard/pagamentos'] = b;
      }
      if (treasury) {
        const o = badge(overdue.length, 'alerta', (n) => `${plural(n, 'irmão', 'irmãos')} com mensalidade vencida`);
        if (o) out['/dashboard/relatorios/inadimplencia'] = o;
        const a = badge(approvals, 'atencao', (n) => `${plural(n, 'despesa', 'despesas')} esperando aprovação`);
        if (a) out['/dashboard/contas'] = a;
      }
      if (admission) {
        const c = badge(candidates, 'atencao', (n) => `${plural(n, 'processo', 'processos')} de admissão em andamento`);
        if (c) out['/dashboard/candidatos'] = c;
      }
    });
    return out;
  } catch {
    return {};
  }
}
