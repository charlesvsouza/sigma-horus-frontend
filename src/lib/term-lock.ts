import type { Prisma } from '@/generated/prisma/client';

// Trava de período encerrado: após o Admin encerrar um veneralato (Term.status =
// 'closed' com endDate definida), nenhum lançamento financeiro pode cair dentro
// do intervalo [startDate, endDate] desse período. Garante a integridade da
// prestação de contas já aprovada.
export async function findClosedTermForDate(
  db: Prisma.TransactionClient,
  lodgeId: string,
  date: Date,
): Promise<{ id: string; title: string } | null> {
  const term = await db.term.findFirst({
    where: {
      lodgeId,
      status: 'closed',
      startDate: { lte: date },
      endDate: { gte: date }, // exclui automaticamente períodos sem endDate
    },
    select: { id: true, title: true },
  });
  return term;
}

/** Lança um objeto-erro padronizado (status 409) se a data estiver em período encerrado. */
export async function assertPeriodOpen(db: Prisma.TransactionClient, lodgeId: string, date: Date) {
  const locked = await findClosedTermForDate(db, lodgeId, date);
  if (locked) {
    return { locked: true as const, term: locked };
  }
  return { locked: false as const };
}
