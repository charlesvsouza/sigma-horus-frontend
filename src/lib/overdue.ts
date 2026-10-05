import type { Prisma } from '@/generated/prisma/client';
import { sumMoney } from '@/lib/money';
import { daysOverdueBR, todayBR } from '@/lib/date-only';

// Art. 002 (regimento): suspensão dos direitos maçônicos do membro inadimplente
// há mais de 60 dias. A regra vale só para mensalidade (Account.isDues=true;
// Invoice herda o flag da Account-pai via accountId) — cobranças pontuais
// (evento, campanha) não contam. O critério é o vencimento mais antigo em
// aberto: se ele já passou de 60 dias, o membro está enquadrado, mesmo que
// tenha quitado parcelas mais recentes fora de ordem ("bola de neve").
import { ART_002_THRESHOLD_DAYS } from '@/lib/overdue-rules';
export { ART_002_THRESHOLD_DAYS };

// É mensalidade quem tem o flag no lançamento OU está na categoria Mensalidades
// (ChartAccount.isDues). Só o flag não basta: lançamentos feitos antes da
// categoria carregar isDues — e as ocorrências de recorrência que herdam o flag
// da cobrança-mãe — ficavam de fora do relatório e da régua do Art. 002.
export const DUES_ACCOUNT_WHERE = {
  OR: [{ isDues: true }, { chartAccount: { isDues: true } }],
} satisfies Prisma.AccountWhereInput;
// Vencimento é data-só-dia (00:00 UTC) e "hoje" é o calendário de Brasília:
// vence hoje = 0 dias (em dia); só passa a atrasado no dia seguinte.
export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  return daysOverdueBR(dueDate, now);
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
  // Isentos (ex.: Maçom Remido) nunca entram na regra do Art. 002.
  const memberFilter = { duesExempt: false } as const;
  const [accounts, invoices] = await Promise.all([
    db.account.findMany({
      where: {
        lodgeId,
        type: 'RECEIVABLE',
        ...DUES_ACCOUNT_WHERE,
        status: { not: 'paid' },
        // Lançamento que já tem cobrança (Invoice) é contado pela Invoice — senão
        // o par Account+Invoice do mesmo débito entraria duas vezes.
        invoices: { none: {} },
        memberId: memberId ?? { not: null },
        dueDate: { lt: todayBR(now) },
        member: memberFilter,
      },
      select: { memberId: true, amount: true, dueDate: true },
    }),
    db.invoice.findMany({
      where: {
        lodgeId,
        status: { not: 'paid' },
        memberId: memberId ?? { not: null },
        dueDate: { lt: todayBR(now) },
        account: DUES_ACCOUNT_WHERE,
        member: memberFilter,
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
    amount: sumMoney(open.map((item) => item.amount)),
    oldestDueDate: oldest.dueDate,
    openCount: open.length,
  };
}

// Multa/juros: fonte única em lib/late-charge (reexportado aqui para quem já importava daqui).
export { calculateLateCharge, type LateCharge } from '@/lib/late-charge';
import { calculateLateCharge, type LateCharge } from '@/lib/late-charge';

/**
 * Soma a multa/juros de CADA pendência pelos seus próprios dias de atraso
 * (não os dias do item mais antigo aplicados sobre a soma total — isso
 * superestimaria o encargo sempre que o membro tiver pendências de idades
 * diferentes, já que cada uma vence e acumula juros num ritmo próprio).
 */
export function sumLateCharges(
  items: { amount: number; dueDate: Date }[],
  now: Date,
  feePercent?: number | null,
  interestPercentMonth?: number | null,
): LateCharge {
  return items.reduce(
    (acc, item) => {
      const c = calculateLateCharge(item.amount, daysOverdue(item.dueDate, now), feePercent, interestPercentMonth);
      return { fee: acc.fee + c.fee, interest: acc.interest + c.interest, total: acc.total + c.total };
    },
    { fee: 0, interest: 0, total: 0 },
  );
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
  lateCharge: LateCharge; // multa/juros informativos sobre o total, calculados no vencimento mais antigo
}

/** Relatório de inadimplência de mensalidades de todos os membros da loja. */
export async function getLodgeOverdueDuesReport(
  db: Prisma.TransactionClient,
  lodgeId: string,
  now: Date = new Date(),
): Promise<OverdueReportRow[]> {
  const [open, members, lodge] = await Promise.all([
    findOpenDues(db, lodgeId, undefined, now),
    db.member.findMany({ where: { lodgeId }, select: { id: true, name: true, status: true } }),
    db.lodge.findUnique({ where: { id: lodgeId }, select: { lateFeePercent: true, lateInterestPercentMonth: true } }),
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
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    return {
      memberId,
      memberName: memberById.get(memberId)?.name ?? '—',
      memberStatus: memberById.get(memberId)?.status ?? 'active',
      openCount: items.length,
      totalAmount,
      oldestDueDate: oldest.dueDate,
      daysOverdue: overdue,
      art002: overdue > ART_002_THRESHOLD_DAYS,
      lateCharge: sumLateCharges(items, now, lodge?.lateFeePercent, lodge?.lateInterestPercentMonth),
    };
  });

  rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return rows;
}

/** true por padrão (Lodge ausente ou sem o campo carregado) — mesmo default do schema. */
export function isArt002Enabled(lodge?: { art002Enabled: boolean } | null): boolean {
  return lodge?.art002Enabled ?? true;
}
