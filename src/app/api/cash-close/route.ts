import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// PASSO 1 do encerramento: o Tesoureiro gera o fechamento de caixa (snapshot)
// do período. Calcula o saldo final (closingBalance) a partir do saldo herdado
// (openingBalance do Term) + entradas (pagamentos) − saídas (contas a pagar).
// Ainda NÃO encerra o veneralato — depende da aprovação (Venerável) e do
// encerramento (Admin).
export async function POST(request: Request) {
  const s = await auth();
  const lodgeId = s?.user?.lodgeId;
  const role = s?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const termId = String(body?.termId ?? '');
  const notes = body?.notes ? String(body.notes) : null;
  if (!termId) return NextResponse.json({ error: 'termId é obrigatório.' }, { status: 400 });

  const result = await withTenant(String(lodgeId), async (db) => {
    const term = await db.term.findFirst({ where: { id: termId, lodgeId: String(lodgeId) } });
    if (!term) return { error: 'notfound' as const };

    const existing = await db.cashClose.findUnique({ where: { lodgeId_termId: { lodgeId: String(lodgeId), termId } } });
    if (existing) return { error: 'exists' as const };

    // Escopado ao período (startDate..endDate/agora) — sem isso, reabrir a
    // conta somaria de novo tudo desde o início da loja, mesmo o que já foi
    // fechado em gestões anteriores (o openingBalance herdado cobriria o
    // passado só enquanto nada mudasse retroativamente).
    const periodEnd = term.endDate ?? new Date();
    const [accounts, payments] = await Promise.all([
      db.account.findMany({
        where: { lodgeId: String(lodgeId), dueDate: { gte: term.startDate, lte: periodEnd } },
        select: { amount: true, type: true },
      }),
      db.payment.findMany({
        where: { lodgeId: String(lodgeId), paidAt: { gte: term.startDate, lte: periodEnd } },
        select: { amount: true },
      }),
    ]);

    const totalReceivables = accounts.filter((a) => a.type === 'RECEIVABLE').reduce((sum, a) => sum + Number(a.amount ?? 0), 0);
    const totalPayables = accounts.filter((a) => a.type === 'PAYABLE').reduce((sum, a) => sum + Number(a.amount ?? 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    const netBalance = totalPayments - totalPayables;
    const openingBalance = Number(term.openingBalance ?? 0);
    const closingBalance = openingBalance + netBalance;

    const close = await db.cashClose.create({
      data: { lodgeId: String(lodgeId), termId, totalReceivables, totalPayables, totalPayments, netBalance, openingBalance, closingBalance, notes },
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: s.user.id, action: 'CREATE', entity: 'cashClose', entityId: close.id, metadata: { termId, openingBalance, closingBalance } });
    return { close };
  });

  if ('error' in result) {
    if (result.error === 'notfound') return NextResponse.json({ error: 'Período não encontrado.' }, { status: 404 });
    return NextResponse.json({ error: 'Fechamento já existe para este período.' }, { status: 409 });
  }

  return NextResponse.json({ item: result.close });
}

// Desfaz o Passo 1 (fechamento de caixa) enquanto ainda não foi aprovado pelo
// Venerável — permite ao Tesoureiro refazer se o fechamento saiu errado, sem
// precisar mexer em dado nenhum de Account/Payment.
export async function DELETE(request: Request) {
  const s = await auth();
  const lodgeId = s?.user?.lodgeId;
  const role = s?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const termId = new URL(request.url).searchParams.get('termId') ?? '';
  if (!termId) return NextResponse.json({ error: 'termId é obrigatório.' }, { status: 400 });

  const result = await withTenant(String(lodgeId), async (db) => {
    const close = await db.cashClose.findUnique({ where: { lodgeId_termId: { lodgeId: String(lodgeId), termId } } });
    if (!close) return { error: 'notfound' as const };
    if (close.approved) return { error: 'approved' as const };

    await db.cashClose.delete({ where: { id: close.id } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: s.user.id, action: 'DELETE', entity: 'cashClose', entityId: close.id, metadata: { termId } });
    return { ok: true as const };
  });

  if ('error' in result) {
    if (result.error === 'notfound') return NextResponse.json({ error: 'Fechamento não encontrado.' }, { status: 404 });
    return NextResponse.json({ error: 'Prestação de contas já aprovada — não é possível desfazer o fechamento.' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
