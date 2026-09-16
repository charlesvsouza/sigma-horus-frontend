import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { findClosedTermForDate } from '@/lib/term-lock';
import { NextResponse } from 'next/server';

// Transferência entre contas financeiras da loja (ex.: sacar do banco pro
// caixa). Passo 1: o Tesoureiro (ou Admin) cria — nasce "pending" e ainda NÃO
// afeta saldo. Passo 2 (ver [id]/approve): o Venerável ou Admin efetiva.
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.accountTransfer.findMany({
      where: { lodgeId: String(lodgeId) },
      include: {
        from: { select: { id: true, name: true, kind: true } },
        to: { select: { id: true, name: true, kind: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;

  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const fromId = String(body?.fromId ?? '').trim();
  const toId = String(body?.toId ?? '').trim();
  const amount = Number(body?.amount ?? 0);
  const date = body?.date ? new Date(body.date) : new Date();
  const note = String(body?.note ?? '').trim();

  if (!fromId || !toId || fromId === toId || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Dados inválidos: escolha duas contas diferentes e um valor positivo.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const locked = await findClosedTermForDate(db, String(lodgeId), date);
    if (locked) return { locked } as const;

    const [from, to] = await Promise.all([
      db.financialAccount.findFirst({ where: { id: fromId, lodgeId: String(lodgeId), active: true }, select: { id: true } }),
      db.financialAccount.findFirst({ where: { id: toId, lodgeId: String(lodgeId), active: true }, select: { id: true } }),
    ]);
    if (!from || !to) return { invalidAccounts: true as const };

    const created = await db.accountTransfer.create({
      data: {
        lodgeId: String(lodgeId),
        fromId: from.id,
        toId: to.id,
        amount,
        date,
        note: note || null,
        status: 'pending',
        createdById: session.user.id,
      },
      include: {
        from: { select: { id: true, name: true, kind: true } },
        to: { select: { id: true, name: true, kind: true } },
      },
    });

    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'CREATE',
      entity: 'accountTransfer',
      entityId: created.id,
      metadata: { fromId: from.id, toId: to.id, amount },
    });

    return { created };
  });

  if ('locked' in result && result.locked) {
    return NextResponse.json(
      { error: `Período encerrado (${result.locked.title}). Não é possível transferir com data dentro de um veneralato já fechado.` },
      { status: 409 },
    );
  }
  if ('invalidAccounts' in result) {
    return NextResponse.json({ error: 'Uma das contas selecionadas não existe ou está inativa.' }, { status: 400 });
  }

  return NextResponse.json({ item: result.created });
}
