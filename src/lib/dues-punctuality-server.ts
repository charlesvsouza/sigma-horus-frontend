import type { Prisma } from '@/generated/prisma/client';
import { todayBR } from '@/lib/date-only';
import { ledgerDayKey } from '@/lib/ledger-day';
import { DUES_ACCOUNT_WHERE } from '@/lib/overdue';
import { classifyDue, monthRange, summarizePunctuality, type PunctualityBucket } from '@/lib/dues-punctuality';

type Db = Prisma.TransactionClient;
// Dia contábil do pagamento (só-dia vale o dia digitado; instante vale o dia de Brasília): subtrair 3 h de uma
// data digitada devolvia o dia ANTERIOR e um pagamento 1 dia atrasado contava como "em dia".
const brDay = ledgerDayKey;

export interface PunctualityRow { accountId: string; memberId: string | null; memberName: string; amount: number; dueDay: string; paidDay: string | null; bucket: PunctualityBucket }

/** Mensalidades (flag OU categoria) com vencimento no mês, de irmãos não isentos, classificadas por pontualidade. */
export async function loadDuesPunctuality(db: Db, lodgeId: string, month: string, now: Date = new Date()) {
  const { start, end } = monthRange(month);
  const todayDay = todayBR(now).toISOString().slice(0, 10);
  const accounts = await db.account.findMany({
    where: { lodgeId, type: 'RECEIVABLE', ...DUES_ACCOUNT_WHERE, memberId: { not: null }, member: { duesExempt: false }, dueDate: { gte: start, lt: end } },
    select: { id: true, memberId: true, amount: true, status: true, dueDate: true, member: { select: { name: true } }, payments: { select: { paidAt: true }, orderBy: { paidAt: 'desc' }, take: 1 } },
    orderBy: [{ dueDate: 'asc' }],
  });
  const rows: PunctualityRow[] = [];
  for (const a of accounts) {
    const dueDay = a.dueDate.toISOString().slice(0, 10);
    const paidDay = a.payments[0] ? brDay(a.payments[0].paidAt) : null;
    const bucket = classifyDue({ status: a.status, dueDay, paidDay }, todayDay);
    if (!bucket) continue;
    rows.push({ accountId: a.id, memberId: a.memberId, memberName: a.member?.name ?? '—', amount: Number(a.amount), dueDay, paidDay, bucket });
  }
  rows.sort((x, y) => x.memberName.localeCompare(y.memberName, 'pt-BR'));
  return { month, todayDay, rows, summary: summarizePunctuality(rows.map((r) => r.bucket)) };
}
