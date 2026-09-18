import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { createChargesWithAccounts } from '@/lib/charges';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Gera uma cobrança para cada membro da loja (todos os irmãos): para cada um,
// um lançamento a receber próprio (categoria do plano de contas) + a cobrança,
// com número de referência automático (COB-AAAAMM-NNNN sequencial).
export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const chartAccountId = String(body?.chartAccountId ?? '').trim();
  const amount = Number(body?.amount ?? 0);
  const dueDate = body?.dueDate ? new Date(body.dueDate) : new Date();
  const recurringCount = body?.recurringCount != null && body.recurringCount !== '' ? Number(body.recurringCount) : null;
  const scope = body?.scope === 'all' ? 'all' : 'active';

  const result = await withTenant(String(lodgeId), async (db) => {
    // A isenção do Maçom Remido só faz sentido pra mensalidade — cobrar um
    // isento por uma taxa de evento, por exemplo, continua válido com scope="all".
    const chart = await db.chartAccount.findFirst({ where: { id: chartAccountId, lodgeId: String(lodgeId) }, select: { isDues: true } });

    const members = await db.member.findMany({
      where: {
        lodgeId: String(lodgeId),
        ...(chart?.isDues ? { duesExempt: false } : {}),
        ...(scope === 'active' ? { status: 'active' } : {}),
      },
      select: { id: true },
      orderBy: { name: 'asc' },
    });
    if (members.length === 0) return { ok: true, created: 0, members: 0 } as const;

    const created = await createChargesWithAccounts(db, {
      lodgeId: String(lodgeId),
      chartAccountId,
      memberIds: members.map((m) => m.id),
      amount,
      dueDate,
      description: String(body?.description ?? ''),
      isRecurring: Boolean(body?.isRecurring),
      recurringInterval: typeof body?.recurringInterval === 'string' ? body.recurringInterval : 'monthly',
      recurringCount,
    });
    if (!created.ok) return created;

    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'CREATE',
      entity: 'invoice-bulk',
      entityId: String(lodgeId),
      metadata: { created: created.invoiceIds.length, scope, amount, chartAccountId, isRecurring: Boolean(body?.isRecurring) },
    });
    return { ok: true, created: created.invoiceIds.length, members: members.length } as const;
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, created: result.created, members: result.members });
}
