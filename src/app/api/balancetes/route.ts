import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { NextResponse } from 'next/server';

// Balancete periódico (trimestral/semestral) apresentado em sessão — exigido
// pelo regulamento independentemente do encerramento do veneralato inteiro.
// Diferente do CashClose: não trava período, não depende de um Term, pode ser
// gerado quantas vezes for preciso para qualquer intervalo de datas.
export async function GET() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ items: [] });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'read');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const items = await withTenant(String(lodgeId), (db) =>
    db.balancete.findMany({ where: { lodgeId: String(lodgeId) }, orderBy: { periodTo: 'desc' } }),
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
  const from = body?.periodFrom ? new Date(body.periodFrom) : null;
  const to = body?.periodTo ? new Date(body.periodTo) : null;
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: 'Informe um período válido (de/até).' }, { status: 400 });
  }
  const periodTo = new Date(to);
  periodTo.setHours(23, 59, 59, 999);

  const item = await withTenant(String(lodgeId), async (db) => {
    const [accounts, payments] = await Promise.all([
      db.account.findMany({ where: { lodgeId: String(lodgeId), dueDate: { gte: from, lte: periodTo } }, select: { amount: true, type: true } }),
      db.payment.findMany({ where: { lodgeId: String(lodgeId), paidAt: { gte: from, lte: periodTo } }, select: { amount: true } }),
    ]);

    const totalReceivables = accounts.filter((a) => a.type === 'RECEIVABLE').reduce((s, a) => s + Number(a.amount ?? 0), 0);
    const totalPayables = accounts.filter((a) => a.type === 'PAYABLE').reduce((s, a) => s + Number(a.amount ?? 0), 0);
    const totalPayments = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const netBalance = totalPayments - totalPayables;

    const created = await db.balancete.create({
      data: {
        lodgeId: String(lodgeId),
        periodFrom: from,
        periodTo,
        totalReceivables,
        totalPayables,
        totalPayments,
        netBalance,
        notes,
        createdById: session.user.id,
      },
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: session.user.id, action: 'CREATE', entity: 'balancete', entityId: created.id, metadata: { periodFrom: from, periodTo } });
    return created;
  });

  return NextResponse.json({ item });
}
