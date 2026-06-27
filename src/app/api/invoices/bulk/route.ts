import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

function addInterval(date: Date, interval: string) {
  const next = new Date(date);
  switch (interval) {
    case 'quarterly': next.setMonth(next.getMonth() + 3); break;
    case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
    default: next.setMonth(next.getMonth() + 1);
  }
  return next;
}

// Gera uma cobrança para cada membro da loja (todos os irmãos), com número de
// referência automático e coerente (COB-AAAAMM-NNNN sequencial).
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const accountId = String(body?.accountId ?? '').trim();
  const amount = Number(body?.amount ?? 0);
  const dueDate = body?.dueDate ? new Date(body.dueDate) : new Date();
  const description = String(body?.description ?? '').trim();
  const isRecurring = Boolean(body?.isRecurring);
  const recurringInterval = typeof body?.recurringInterval === 'string' ? body.recurringInterval : 'monthly';
  const recurringCount = body?.recurringCount != null && body.recurringCount !== '' ? Number(body.recurringCount) : null;
  const scope = body?.scope === 'all' ? 'all' : 'active';

  if (!accountId || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Selecione a conta e informe um valor válido.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const members = await db.member.findMany({
      where: { lodgeId: String(lodgeId), ...(scope === 'active' ? { status: 'active' } : {}) },
      select: { id: true },
      orderBy: { name: 'asc' },
    });
    if (members.length === 0) return { created: 0, members: 0 };

    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `COB-${ym}-`;
    const existing = await db.invoice.count({ where: { lodgeId: String(lodgeId), number: { startsWith: prefix } } });

    const data = members.map((m, i) => ({
      lodgeId: String(lodgeId),
      accountId,
      memberId: m.id,
      number: `${prefix}${String(existing + 1 + i).padStart(4, '0')}`,
      amount,
      dueDate,
      description: description || null,
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : null,
      recurringCount: isRecurring ? recurringCount : null,
      nextDueDate: isRecurring ? addInterval(dueDate, recurringInterval) : null,
    }));

    await db.invoice.createMany({ data });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'CREATE',
      entity: 'invoice-bulk',
      entityId: String(lodgeId),
      metadata: { created: data.length, scope, amount, accountId, isRecurring },
    });
    return { created: data.length, members: members.length };
  });

  return NextResponse.json({ ok: true, ...result });
}
