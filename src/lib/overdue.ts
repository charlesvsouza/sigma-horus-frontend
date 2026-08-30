import type { Prisma } from '@/generated/prisma/client';
import { prismaAdmin, withTenant } from '@/lib/prisma';

// Art. 002 (regimento): suspensão dos direitos maçônicos do membro inadimplente
// há mais de 60 dias. A regra vale só para mensalidade (Account.isDues=true;
// Invoice herda o flag da Account-pai via accountId) — cobranças pontuais
// (evento, campanha) não contam. O critério é o vencimento mais antigo em
// aberto: se ele já passou de 60 dias, o membro está enquadrado, mesmo que
// tenha quitado parcelas mais recentes fora de ordem ("bola de neve").
export const ART_002_THRESHOLD_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(dueDate).getTime()) / DAY_MS);
}

export interface OpenDue {
  memberId: string;
  amount: number;
  dueDate: Date;
}

async function findOpenDues(
  db: Prisma.TransactionClient,
  lodgeId: string,
  memberId: string | undefined,
  now: Date,
): Promise<OpenDue[]> {
  const [accounts, invoices] = await Promise.all([
    db.account.findMany({
      where: {
        lodgeId,
        type: 'RECEIVABLE',
        isDues: true,
        status: { not: 'paid' },
        memberId: memberId ?? { not: null },
        dueDate: { lt: now },
      },
      select: { memberId: true, amount: true, dueDate: true },
    }),
    db.invoice.findMany({
      where: {
        lodgeId,
        status: { not: 'paid' },
        memberId: memberId ?? { not: null },
        dueDate: { lt: now },
        account: { isDues: true },
      },
      select: { memberId: true, amount: true, dueDate: true },
    }),
  ]);

  return [...accounts, ...invoices]
    .filter((row): row is { memberId: string; amount: number; dueDate: Date } => row.memberId != null)
    .map((row) => ({ memberId: row.memberId, amount: Number(row.amount), dueDate: row.dueDate }));
}

export interface MemberDuesStatus {
  daysOverdue: number;
  amount: number;
  oldestDueDate: Date;
  openCount: number;
}

/** Situação de mensalidade em aberto de UM membro (usado no aviso do portal/dashboard). */
export async function getMemberDuesStatus(
  db: Prisma.TransactionClient,
  lodgeId: string,
  memberId: string,
  now: Date = new Date(),
): Promise<MemberDuesStatus | null> {
  const open = await findOpenDues(db, lodgeId, memberId, now);
  if (open.length === 0) return null;
  const oldest = open.reduce((a, b) => (a.dueDate < b.dueDate ? a : b));
  return {
    daysOverdue: daysOverdue(oldest.dueDate, now),
    amount: open.reduce((sum, item) => sum + item.amount, 0),
    oldestDueDate: oldest.dueDate,
    openCount: open.length,
  };
}

export interface OverdueReportRow {
  memberId: string;
  memberName: string;
  memberStatus: string;
  openCount: number;
  totalAmount: number;
  oldestDueDate: Date;
  daysOverdue: number;
  art002: boolean;
}

/** Relatório de inadimplência de mensalidades de todos os membros da loja. */
export async function getLodgeOverdueDuesReport(
  db: Prisma.TransactionClient,
  lodgeId: string,
  now: Date = new Date(),
): Promise<OverdueReportRow[]> {
  const [open, members] = await Promise.all([
    findOpenDues(db, lodgeId, undefined, now),
    db.member.findMany({ where: { lodgeId }, select: { id: true, name: true, status: true } }),
  ]);

  const byMember = new Map<string, OpenDue[]>();
  for (const item of open) {
    const list = byMember.get(item.memberId) ?? [];
    list.push(item);
    byMember.set(item.memberId, list);
  }

  const memberById = new Map(members.map((m) => [m.id, m]));

  const rows: OverdueReportRow[] = [...byMember.entries()].map(([memberId, items]) => {
    const oldest = items.reduce((a, b) => (a.dueDate < b.dueDate ? a : b));
    const overdue = daysOverdue(oldest.dueDate, now);
    return {
      memberId,
      memberName: memberById.get(memberId)?.name ?? '—',
      memberStatus: memberById.get(memberId)?.status ?? 'active',
      openCount: items.length,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      oldestDueDate: oldest.dueDate,
      daysOverdue: overdue,
      art002: overdue > ART_002_THRESHOLD_DAYS,
    };
  });

  rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return rows;
}

/**
 * Aplica a régua automática do Art. 002 a UM membro: promove para 'art_002'
 * ao cruzar 60 dias (só a partir de 'active', para não sobrescrever outra
 * situação decidida manualmente pela loja — suspenso, Quit Placet etc.) e
 * reverte para 'active' quando a pendência é quitada/excluída. Chamado nos
 * pontos que mudam o quadro financeiro do membro (baixa de pagamento, exclusão
 * de conta, webhook Asaas) e, como rede de segurança, pelo cron diário.
 */
export async function syncMemberArt002Status(
  db: Prisma.TransactionClient,
  lodgeId: string,
  memberId: string,
  now: Date = new Date(),
): Promise<void> {
  const member = await db.member.findFirst({ where: { id: memberId, lodgeId }, select: { status: true } });
  if (!member) return;

  const status = await getMemberDuesStatus(db, lodgeId, memberId, now);
  const overThreshold = (status?.daysOverdue ?? 0) > ART_002_THRESHOLD_DAYS;

  if (overThreshold && member.status === 'active') {
    await db.member.update({ where: { id: memberId }, data: { status: 'art_002' } });
  } else if (!overThreshold && member.status === 'art_002') {
    await db.member.update({ where: { id: memberId }, data: { status: 'active' } });
  }
}

/** Varre todas as lojas e sincroniza o Art. 002 de todo mundo (cron diário). */
export async function syncAllLodgesArt002(): Promise<{ lodges: number; promoted: number; reverted: number }> {
  const lodges = await prismaAdmin.lodge.findMany({ select: { id: true } });
  let promoted = 0;
  let reverted = 0;

  for (const lodge of lodges) {
    await withTenant(lodge.id, async (db) => {
      const report = await getLodgeOverdueDuesReport(db, lodge.id);
      const overdueMemberIds = new Set(report.filter((r) => r.art002).map((r) => r.memberId));

      for (const row of report) {
        if (row.art002 && row.memberStatus === 'active') {
          await db.member.update({ where: { id: row.memberId }, data: { status: 'art_002' } });
          promoted++;
        }
      }

      const currentlyFlagged = await db.member.findMany({
        where: { lodgeId: lodge.id, status: 'art_002' },
        select: { id: true },
      });
      for (const m of currentlyFlagged) {
        if (!overdueMemberIds.has(m.id)) {
          await db.member.update({ where: { id: m.id }, data: { status: 'active' } });
          reverted++;
        }
      }
    });
  }

  return { lodges: lodges.length, promoted, reverted };
}
