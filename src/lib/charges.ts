import type { Prisma } from '@/generated/prisma/client';
import { findClosedTermForDate } from '@/lib/term-lock';
import { lockKey } from '@/lib/locks';

export { addInterval } from '@/lib/recurring-rules';
import { addInterval } from '@/lib/recurring-rules';

/**
 * Reserva os próximos `count` números de cobrança da loja (COB-AAAAMM-NNNN, sequencial por
 * loja/mês). Trava por loja/mês: duas emissões simultâneas não pegam o mesmo número.
 */
export async function nextInvoiceNumbers(db: Prisma.TransactionClient, lodgeId: string, count: number, now: Date = new Date()): Promise<string[]> {
  const prefix = `COB-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
  await lockKey(db, `invoice-number:${lodgeId}:${prefix}`);
  const existing = await db.invoice.count({ where: { lodgeId, number: { startsWith: prefix } } });
  return Array.from({ length: count }, (_, i) => `${prefix}${String(existing + 1 + i).padStart(4, '0')}`);
}

export interface ChargeInput {
  lodgeId: string;
  userId?: string;
  /** Categoria do plano de contas (centro de custo) — define título, classificação e isDues do lançamento. */
  chartAccountId: string;
  memberIds: string[];
  amount: number;
  dueDate: Date;
  description?: string;
  /** Só para cobrança individual; em lote a numeração é sempre automática. */
  number?: string;
  isRecurring?: boolean;
  recurringInterval?: string;
  recurringCount?: number | null;
}

export type ChargeResult =
  | { ok: true; invoiceIds: string[] }
  | { ok: false; status: number; error: string };

/**
 * Cria, para cada membro, o lançamento (Account a receber, 1:1 com o membro) e a
 * cobrança (Invoice) na mesma transação — o mesmo desenho já usado pela doação ao
 * Tronco. A categoria define título, plano de contas e `isDues` (mensalidade →
 * base do Art. 002); o servidor valida categoria, membros e a trava de veneralato.
 */
export async function createChargesWithAccounts(db: Prisma.TransactionClient, input: ChargeInput): Promise<ChargeResult> {
  const { lodgeId, chartAccountId, memberIds, amount, dueDate } = input;
  const description = input.description?.trim() || null;
  const isRecurring = Boolean(input.isRecurring);
  const recurringInterval = input.recurringInterval ?? 'monthly';

  if (!chartAccountId || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 400, error: 'Selecione a categoria e informe um valor válido.' };
  }
  if (memberIds.length === 0) return { ok: false, status: 400, error: 'Nenhum membro para cobrar.' };
  if (Number.isNaN(dueDate.getTime())) return { ok: false, status: 400, error: 'Vencimento inválido.' };

  // Tronco é doação voluntária (fluxo próprio na Hospitalaria) — não se cobra por aqui.
  const chart = await db.chartAccount.findFirst({
    where: { id: chartAccountId, lodgeId, type: 'REVENUE', active: true, isSolidarity: false },
    select: { id: true, name: true, isDues: true },
  });
  if (!chart) return { ok: false, status: 400, error: 'Categoria inválida para cobrança.' };

  const locked = await findClosedTermForDate(db, lodgeId, dueDate);
  if (locked) {
    return { ok: false, status: 409, error: `Período encerrado (${locked.title}). Não é possível cobrar com vencimento dentro de um veneralato já fechado.` };
  }

  const numbers = await nextInvoiceNumbers(db, lodgeId, memberIds.length);

  const accounts = await db.account.createManyAndReturn({
    data: memberIds.map((memberId) => ({
      lodgeId,
      type: 'RECEIVABLE',
      title: chart.name,
      amount,
      dueDate,
      description,
      memberId,
      chartAccountId: chart.id,
      isDues: chart.isDues,
    })),
    select: { id: true, memberId: true },
  });

  const number = input.number?.trim();
  const invoices = await db.invoice.createManyAndReturn({
    data: accounts.map((a, i) => ({
      lodgeId,
      accountId: a.id,
      memberId: a.memberId,
      number: memberIds.length === 1 && number ? number : numbers[i],
      amount,
      dueDate,
      description,
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : null,
      recurringCount: isRecurring ? (input.recurringCount ?? null) : null,
      nextDueDate: isRecurring ? addInterval(dueDate, recurringInterval) : null,
    })),
    select: { id: true },
  });

  return { ok: true, invoiceIds: invoices.map((i) => i.id) };
}
