import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Gera um número de referência coerente e único por loja, no formato
 * COB-AAAAMM-NNNN (sequencial dentro do mês corrente). O `offset` permite
 * numerar um lote (cobrança em massa) sem colisão dentro da mesma transação.
 */
async function nextInvoiceNumber(
  db: { invoice: { count: (args: { where: Record<string, unknown> }) => Promise<number> } },
  lodgeId: string,
  offset = 0,
): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `COB-${ym}-`;
  const count = await db.invoice.count({ where: { lodgeId, number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1 + offset).padStart(4, '0')}`;
}

function addInterval(date: Date, interval: string) {
  const nextDate = new Date(date);

  switch (interval) {
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate;
}

export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ items: [] });
  }

  const items = await withTenant(String(lodgeId), (db) =>
    db.invoice.findMany({
      where: { lodgeId: String(lodgeId) },
      include: {
        account: { select: { id: true, title: true } },
        member: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const accountId = String(body?.accountId ?? '').trim();
  const memberId = body?.memberId ? String(body.memberId) : null;
  const number = String(body?.number ?? '').trim();
  const amount = Number(body?.amount ?? 0);
  const dueDate = body?.dueDate ? new Date(body.dueDate) : new Date();
  const description = String(body?.description ?? '').trim();
  const isRecurring = Boolean(body?.isRecurring);
  const recurringInterval = typeof body?.recurringInterval === 'string' ? body.recurringInterval : 'monthly';
  const recurringCount = body?.recurringCount != null && body.recurringCount !== '' ? Number(body.recurringCount) : null;

  if (!accountId || Number.isNaN(amount)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const item = await withTenant(String(lodgeId), async (db) => {
    const finalNumber = number || (await nextInvoiceNumber(db, String(lodgeId)));
    const created = await db.invoice.create({
      data: {
        lodgeId: String(lodgeId),
        accountId,
        memberId,
        number: finalNumber,
        amount,
        dueDate,
        description: description || null,
        isRecurring,
        recurringInterval: isRecurring ? recurringInterval : null,
        recurringCount: isRecurring ? recurringCount : null,
        nextDueDate: isRecurring ? addInterval(dueDate, recurringInterval) : null,
      },
      include: {
        account: { select: { id: true, title: true } },
        member: { select: { id: true, name: true } },
      },
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'invoice', entityId: created.id, metadata: { number: finalNumber, amount, accountId } });
    return created;
  });

  return NextResponse.json({ item });
}
