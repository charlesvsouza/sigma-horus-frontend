import { auth } from '@/lib/auth';
import { firstInvalidDate, INVALID_DATE_MESSAGE, todayBR } from '@/lib/date-only';
import { CANDIDATE_STATUS } from '@/lib/candidate';
import { BLOCKED_STATUS } from '@/lib/member-block';
import { logAudit } from '@/lib/audit';
import { createChargesWithAccounts } from '@/lib/charges';
import { duesAmountFor } from '@/lib/dues-benefit';
import { isValidMoney } from '@/lib/money';
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

  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });
  const badDate = firstInvalidDate(body, ['dueDate']);
  if (badDate) return NextResponse.json({ error: `${INVALID_DATE_MESSAGE} (campo: ${badDate})` }, { status: 400 });
  const chartAccountId = String(body?.chartAccountId ?? '').trim();
  const amount = Number(body?.amount ?? 0);
  const dueDate = body?.dueDate ? new Date(body.dueDate) : todayBR();
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
        // "Todos" = todos os obreiros; candidato é cobrado um a um (taxa de iniciação etc.) e o bloqueado
        // (comunicado à Potência) só se regulariza pelo acordo.
        ...(scope === 'active' ? { status: 'active' } : { status: { notIn: [CANDIDATE_STATUS, BLOCKED_STATUS] } }),
      },
      select: { id: true, duesPotencyOnly: true },
      orderBy: { name: 'asc' },
    });
    if (members.length === 0) return { ok: true, created: 0, members: 0 } as const;

    // Benefício "só a Potência": a mensalidade desses irmãos nasce no valor da Potência (Configurações da loja).
    const potencyMembers = chart?.isDues ? members.filter((m) => m.duesPotencyOnly) : [];
    const potencyAmount = potencyMembers.length > 0 ? (await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { powerDuesAmount: true } }))?.powerDuesAmount ?? null : null;
    if (potencyMembers.length > 0 && !(potencyAmount != null && isValidMoney(potencyAmount))) {
      return { ok: false, status: 400, error: `${potencyMembers.length} irmão(s) têm o benefício "só a parte da Potência". Informe o valor da Potência em Configurações da loja antes de cobrar a mensalidade.` } as const;
    }
    const groups = new Map<number, string[]>();
    for (const m of members) {
      const value = duesAmountFor(m, amount, potencyAmount);
      groups.set(value, [...(groups.get(value) ?? []), m.id]);
    }

    const invoiceIds: string[] = [];
    for (const [groupAmount, memberIds] of groups) {
      const created = await createChargesWithAccounts(db, {
        lodgeId: String(lodgeId),
        chartAccountId,
        memberIds,
        amount: groupAmount,
        dueDate,
        description: String(body?.description ?? ''),
        isRecurring: Boolean(body?.isRecurring),
        recurringInterval: typeof body?.recurringInterval === 'string' ? body.recurringInterval : 'monthly',
        recurringCount,
      });
      if (!created.ok) return created;
      invoiceIds.push(...created.invoiceIds);
    }

    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'CREATE',
      entity: 'invoice-bulk',
      entityId: String(lodgeId),
      metadata: { created: invoiceIds.length, potencyOnly: potencyMembers.length, scope, amount, chartAccountId, isRecurring: Boolean(body?.isRecurring) },
    });
    return { ok: true, created: invoiceIds.length, members: members.length } as const;
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, created: result.created, members: result.members });
}
