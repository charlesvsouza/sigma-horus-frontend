import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

const KINDS = ['bank', 'cash'];
const PURPOSES = ['general', 'tronco', 'donations'];

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
  const body = await request.json();

  if (body?.kind != null && !KINDS.includes(String(body.kind))) {
    return NextResponse.json({ error: 'Tipo deve ser bank ou cash.' }, { status: 400 });
  }

  if (body?.purpose != null && !PURPOSES.includes(String(body.purpose))) {
    return NextResponse.json({ error: 'Finalidade inválida.' }, { status: 400 });
  }

  const fields = ['name', 'kind', 'purpose', 'bankName', 'isInvestment', 'agency', 'accountNumber', 'openingBalance', 'isDefault', 'active'] as const;
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    if (body?.[f] === undefined) continue;
    if (f === 'openingBalance') { data[f] = Number(body[f]) || 0; continue; }
    data[f] = typeof body[f] === 'string' ? body[f].trim() || null : body[f];
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const existing = await db.financialAccount.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!existing) return { notFound: true as const };
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
