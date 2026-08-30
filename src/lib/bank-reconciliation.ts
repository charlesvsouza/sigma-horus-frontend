import type { Prisma } from '@/generated/prisma/client';
import { parseBankStatement } from '@/lib/bank-statement';

const MATCH_WINDOW_DAYS = 3;
const AMOUNT_TOLERANCE = 0.01;

/** Tenta casar UMA linha do extrato com um Payment ainda não conciliado, pela
 * combinação (valor ± tolerância, data ± janela, direção receber/pagar). Só
 * casa quando há exatamente UM candidato — ambíguo fica pra revisão manual. */
async function tryAutoMatch(db: Prisma.TransactionClient, lodgeId: string, date: Date, amount: number): Promise<string | null> {
  const direction = amount >= 0 ? 'RECEIVABLE' : 'PAYABLE';
  const absAmount = Math.abs(amount);
  const from = new Date(date.getTime() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const to = new Date(date.getTime() + MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await db.payment.findMany({
    where: {
      lodgeId,
      amount: { gte: absAmount - AMOUNT_TOLERANCE, lte: absAmount + AMOUNT_TOLERANCE },
      paidAt: { gte: from, lte: to },
      bankTransactions: { none: {} },
      account: { type: direction },
    },
    select: { id: true },
  });

  return candidates.length === 1 ? candidates[0].id : null;
}

export interface ImportSummary {
  parsed: number;
  imported: number;
  duplicates: number;
  autoMatched: number;
}

/** Importa um extrato (OFX/CSV já lido como texto), deduplicando por externalId
 * (FITID) quando disponível, e tenta conciliar automaticamente cada linha nova. */
export async function importBankStatement(db: Prisma.TransactionClient, lodgeId: string, content: string): Promise<ImportSummary> {
  const parsed = parseBankStatement(content);
  let imported = 0;
  let duplicates = 0;
  let autoMatched = 0;

  for (const tx of parsed) {
    if (tx.externalId) {
      const dup = await db.bankTransaction.findFirst({ where: { lodgeId, externalId: tx.externalId } });
      if (dup) { duplicates++; continue; }
    } else {
      // Sem FITID (CSV comum): dedupe best-effort por data+descrição+valor.
      const dup = await db.bankTransaction.findFirst({ where: { lodgeId, date: tx.date, description: tx.description, amount: tx.amount } });
      if (dup) { duplicates++; continue; }
    }

    const matchedPaymentId = await tryAutoMatch(db, lodgeId, tx.date, tx.amount);
    await db.bankTransaction.create({
      data: {
        lodgeId,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        externalId: tx.externalId,
        status: matchedPaymentId ? 'matched' : 'unmatched',
        matchedPaymentId,
      },
    });
    imported++;
    if (matchedPaymentId) autoMatched++;
  }

  return { parsed: parsed.length, imported, duplicates, autoMatched };
}
