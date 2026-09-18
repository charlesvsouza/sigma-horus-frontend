import { auth } from '@/lib/auth';
import { addInterval } from '@/lib/charges';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await auth();
  if (!session?.user?.lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const lodgeId = String(session.user.lodgeId);

  const now = new Date();

  const recurring = await withTenant(lodgeId, (db) =>
    db.invoice.findMany({
      where: {
        lodgeId,
        isRecurring: true,
        nextDueDate: { lte: now },
        recurringCount: { not: 0 },
        status: 'pending',
      },
      include: { account: true },
    }),
  );

  const processed: string[] = [];
  const errors: string[] = [];

  for (const invoice of recurring) {
    try {
      await withTenant(lodgeId, async (tx) => {
        const interval = invoice.recurringInterval ?? 'monthly';
        const nextDueDate = addInterval(invoice.nextDueDate!, interval);

        const newCount = invoice.recurringCount !== null
          ? invoice.recurringCount - 1
          : null;

        const hasMore = newCount === null || newCount > 0;

        // Cada ocorrência tem o próprio lançamento (1:1 com o membro): reaproveitar
        // o Account da primeira faria a baixa dela quitar as ocorrências futuras.
        // Contas compartilhadas (cobranças em massa antigas, sem membro) seguem
        // reaproveitadas, como sempre foi.
        const src = invoice.account;
        let accountId = invoice.accountId;
        if (src.memberId) {
          const account = await tx.account.create({
            data: {
              lodgeId,
              type: 'RECEIVABLE',
              title: src.title,
              amount: invoice.amount,
              dueDate: invoice.nextDueDate!,
              description: src.description,
              memberId: src.memberId,
              chartAccountId: src.chartAccountId,
              isDues: src.isDues,
            },
          });
          accountId = account.id;
        }

        await tx.invoice.create({
          data: {
            lodgeId,
            accountId,
            memberId: invoice.memberId,
            number: `${invoice.number}-${Date.now()}`,
            amount: invoice.amount,
            dueDate: invoice.nextDueDate!,
            description: invoice.description,
            status: 'pending',
            isRecurring: hasMore,
            recurringInterval: hasMore ? invoice.recurringInterval : null,
            recurringCount: newCount,
            nextDueDate: hasMore ? nextDueDate : null,
          },
        });

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            nextDueDate,
            recurringCount: newCount,
            isRecurring: hasMore,
          },
        });
      });
      processed.push(invoice.id);
    } catch {
      errors.push(invoice.id);
    }
  }

  return NextResponse.json({ processed: processed.length, errors: errors.length });
}
