import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';

/**
 * Gera (ou reaproveita, se já existir para o mesmo período) o balancete de um
 * intervalo de datas. Compartilhado pela geração manual (Financeiro →
 * Balancetes) e pelo cron mensal automático — mesma conta, mesma regra.
 */
export async function generateBalancete(
  db: Prisma.TransactionClient,
  params: { lodgeId: string; from: Date; to: Date; notes?: string | null; createdById?: string | null },
) {
  const { lodgeId, from, to, notes = null, createdById = null } = params;

  const existing = await db.balancete.findFirst({ where: { lodgeId, periodFrom: from, periodTo: to } });
  if (existing) return existing;

  const [accounts, payments] = await Promise.all([
    db.account.findMany({ where: { lodgeId, dueDate: { gte: from, lte: to } }, select: { amount: true, type: true } }),
    // Payment serve tanto pra baixa de conta a receber quanto a pagar — sem o
    // tipo da Account associada não dá pra saber se cada linha é entrada ou
    // saída de caixa (ver findClosedTermForDate/PagamentosClient: o mesmo
    // formulário lança os dois sentidos).
    db.payment.findMany({ where: { lodgeId, paidAt: { gte: from, lte: to } }, select: { amount: true, account: { select: { type: true } } } }),
  ]);

  const totalReceivables = accounts.filter((a) => a.type === 'RECEIVABLE').reduce((s, a) => s + Number(a.amount ?? 0), 0);
  const totalPayables = accounts.filter((a) => a.type === 'PAYABLE').reduce((s, a) => s + Number(a.amount ?? 0), 0);
  const cashIn = payments.filter((p) => p.account?.type === 'RECEIVABLE').reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const cashOut = payments.filter((p) => p.account?.type === 'PAYABLE').reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalPayments = cashIn; // "Pagamentos" = dinheiro efetivamente recebido no período (entradas)
  const netBalance = cashIn - cashOut; // saldo de caixa real do período (entradas − saídas), não entradas − obrigações em aberto

  const created = await db.balancete.create({
    data: { lodgeId, periodFrom: from, periodTo: to, totalReceivables, totalPayables, totalPayments, netBalance, notes, createdById },
  });

  await logAudit(db, {
    lodgeId,
    userId: createdById ?? 'system:cron',
    action: 'CREATE',
    entity: 'balancete',
    entityId: created.id,
    metadata: { periodFrom: from, periodTo: to, auto: !createdById },
  });

  return created;
}

/** Primeiro e último dia do mês anterior a `ref`, com horário zerado/cheio. */
export function previousMonthRange(ref: Date = new Date()): { from: Date; to: Date } {
  const from = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 0, 23, 59, 59, 999));
  return { from, to };
}
