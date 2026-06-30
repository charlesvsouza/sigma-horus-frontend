import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

function addInterval(date: Date, interval: string) {
  const next = new Date(date);
  switch (interval) {
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

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

        await tx.invoice.create({
          data: {
            lodgeId,
            accountId: invoice.accountId,
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
