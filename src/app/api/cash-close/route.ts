import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const s = await auth();
  const lodgeId = s?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const termId = String(body?.termId ?? '');
  const notes = body?.notes ? String(body.notes) : null;
  if (!termId) return NextResponse.json({ error: 'termId é obrigatório.' }, { status: 400 });

  const result = await withTenant(String(lodgeId), async (db) => {
    const term = await db.term.findFirst({ where: { id: termId, lodgeId: String(lodgeId) } });
    if (!term) return { error: 'notfound' as const };

    const existing = await db.cashClose.findUnique({ where: { lodgeId_termId: { lodgeId: String(lodgeId), termId } } });
    if (existing) return { error: 'exists' as const };

    const [accounts, payments] = await Promise.all([
      db.account.findMany({ where: { lodgeId: String(lodgeId) }, select: { amount: true, type: true } }),
      db.payment.findMany({ where: { lodgeId: String(lodgeId) }, select: { amount: true } }),
    ]);

    const totalReceivables = accounts.filter((a) => a.type === 'RECEIVABLE').reduce((sum, a) => sum + Number(a.amount ?? 0), 0);
    const totalPayables = accounts.filter((a) => a.type === 'PAYABLE').reduce((sum, a) => sum + Number(a.amount ?? 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    const netBalance = totalPayments - totalPayables;

    const close = await db.cashClose.create({
      data: { lodgeId: String(lodgeId), termId, totalReceivables, totalPayables, totalPayments, netBalance, notes },
    });

    await logAudit(db, { lodgeId: String(lodgeId), userId: s.user.id, action: 'CREATE', entity: 'cashClose', entityId: close.id, metadata: { termId, netBalance } });
    return { close };
  });

  if ('error' in result) {
    if (result.error === 'notfound') return NextResponse.json({ error: 'Período não encontrado.' }, { status: 404 });
    return NextResponse.json({ error: 'Fechamento já existe para este período.' }, { status: 409 });
  }

  return NextResponse.json({ item: result.close });
}
