import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';
import { hasAtMostCents } from '@/lib/money';
import { checkLedgerOpen, getActiveCheckpoint } from '@/lib/ledger-lock-server';

const KINDS = ['bank', 'cash'];

async function getSessionAndCheck(lodgeId: string | undefined, role: string | undefined) {
  if (!lodgeId) return { error: 'Unauthorized', status: 401 } as const;
  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return { error: access.error, status: access.status } as const;
  return { ok: true as const };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const check = await getSessionAndCheck(lodgeId, role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });

  if (body?.kind != null && !KINDS.includes(String(body.kind))) {
    return NextResponse.json({ error: 'Tipo deve ser bank ou cash.' }, { status: 400 });
  }

  const fields = ['name', 'kind', 'bankName', 'isInvestment', 'agency', 'accountNumber', 'openingBalance', 'isDefault', 'active'] as const;
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    if (body?.[f] === undefined) continue;
    if (f === 'openingBalance') {
      const value = Number(body[f]) || 0;
      if (!hasAtMostCents(value)) return NextResponse.json({ error: 'Saldo inicial inválido: use no máximo 2 casas decimais.' }, { status: 400 });
      data[f] = value;
      continue;
    }
    data[f] = typeof body[f] === 'string' ? body[f].trim() || null : body[f];
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.financialAccount.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return { notFound: true as const };
    // Saldo inicial muda TODOS os saldos da conta: com o livro conferido, só com retificação aprovada que
    // inclua o dia da conferência (o pedido precisa abranger até esse dia).
    if (data.openingBalance !== undefined && Math.round(Number(data.openingBalance) * 100) !== Math.round(existing.openingBalance * 100)) {
      const checkpoint = await getActiveCheckpoint(db, String(lodgeId));
      if (checkpoint) {
        const ledger = await checkLedgerOpen(db, String(lodgeId), [checkpoint.throughKey], { userId: session!.user.id, what: 'financialAccount.openingBalance' });
        if (!ledger.ok) return { ledgerLocked: ledger.error } as const;
      }
    }
    await db.financialAccount.updateMany({ where: { id, lodgeId: String(lodgeId) }, data });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session!.user.id,
      action: 'UPDATE',
      entity: 'financialAccount',
      entityId: id,
      metadata: data,
    });
    return { ok: true as const };
  });

  if ('ledgerLocked' in result) return NextResponse.json({ error: result.ledgerLocked, code: 'LEDGER_LOCKED' }, { status: 409 });
  if ('notFound' in result) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const check = await getSessionAndCheck(lodgeId, role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;

  const result = await withTenant(String(lodgeId), async (db) => {
    const item = await db.financialAccount.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!item) return { notFound: true as const };

    const [accountsCount, paymentsCount, transfersCount] = await Promise.all([
      db.account.count({ where: { bankAccountId: id } }),
      db.payment.count({ where: { bankAccountId: id } }),
      db.accountTransfer.count({ where: { OR: [{ fromId: id }, { toId: id }] } }),
    ]);
    if (accountsCount || paymentsCount || transfersCount) {
      return { inUse: true as const };
    }

    await db.financialAccount.delete({ where: { id } });
    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session!.user.id,
      action: 'DELETE',
      entity: 'financialAccount',
      entityId: id,
      metadata: { name: item.name },
    });
    return { ok: true as const };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
  if ('inUse' in result) {
    return NextResponse.json({ error: 'Conta já usada em lançamentos/transferências — desative em vez de excluir.' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
