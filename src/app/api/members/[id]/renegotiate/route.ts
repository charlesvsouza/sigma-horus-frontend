import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { findClosedTermForDate } from '@/lib/term-lock';
import { calculateLateCharge, daysOverdue, syncMemberArt002Status } from '@/lib/overdue';
import { NextResponse } from 'next/server';

function addMonths(date: Date, n: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// Renegocia a dívida do membro: consolida as mensalidades em aberto (vencidas)
// numa nova sequência de parcelas mensais com vencimento futuro, opcionalmente
// somando multa/juros de mora calculados sobre o total. Reaproveita as MESMAS
// contas (Account) — atualiza valor/vencimento em vez de criar linhas novas,
// preservando o rastro de auditoria e evitando duplicar "a receber" nos
// relatórios. Some do Art. 002 assim que os vencimentos passam a ser futuros.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireLodgeAccess(String(lodgeId), role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id: memberId } = await params;
  const body = await request.json().catch(() => ({}));
  const firstDueDate = body?.firstDueDate ? new Date(body.firstDueDate) : addMonths(new Date(), 1);
  const applyLateCharge = Boolean(body?.applyLateCharge);
  if (Number.isNaN(firstDueDate.getTime())) {
    return NextResponse.json({ error: 'Data do primeiro vencimento inválida.' }, { status: 400 });
  }

  const now = new Date();

  const result = await withTenant(String(lodgeId), async (db) => {
    const member = await db.member.findFirst({ where: { id: memberId, lodgeId: String(lodgeId) }, select: { id: true, name: true } });
    if (!member) return { error: 'notfound' as const };

    const openAccounts = await db.account.findMany({
      where: { lodgeId: String(lodgeId), memberId, type: 'RECEIVABLE', isDues: true, status: { not: 'paid' }, dueDate: { lt: now } },
      orderBy: { dueDate: 'asc' },
    });
    if (openAccounts.length === 0) return { error: 'noopen' as const };

    let total = openAccounts.reduce((sum, a) => sum + Number(a.amount), 0);
    let lateCharge = { fee: 0, interest: 0, total } as ReturnType<typeof calculateLateCharge>;
    if (applyLateCharge) {
      const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { lateFeePercent: true, lateInterestPercentMonth: true } });
      const oldestOverdue = daysOverdue(openAccounts[0].dueDate, now);
      lateCharge = calculateLateCharge(total, oldestOverdue, lodge?.lateFeePercent, lodge?.lateInterestPercentMonth);
      total = lateCharge.total;
    }

    const n = openAccounts.length;
    const base = Math.floor((total / n) * 100) / 100;
    const roundedTotal = base * (n - 1);
    const lastAmount = Math.round((total - roundedTotal) * 100) / 100;

    const updated = [];
    for (let i = 0; i < n; i++) {
      const dueDate = addMonths(firstDueDate, i);
      const lockedFor = await findClosedTermForDate(db, String(lodgeId), dueDate);
      if (lockedFor) return { error: 'locked' as const, term: lockedFor };

      const amount = i === n - 1 ? lastAmount : base;
      const acc = await db.account.update({
        where: { id: openAccounts[i].id },
        data: {
          amount,
          dueDate,
          status: 'pending',
          title: `${openAccounts[i].title} (renegociado — parcela ${i + 1}/${n})`,
        },
      });
      updated.push(acc);
    }

    await syncMemberArt002Status(db, String(lodgeId), memberId);

    await logAudit(db, {
      lodgeId: String(lodgeId),
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'account',
      entityId: memberId,
      metadata: { action: 'renegotiate', memberId, installments: n, total, lateCharge: applyLateCharge ? lateCharge : null },
    });

    return { updated, installments: n, total, lateCharge: applyLateCharge ? lateCharge : null };
  });

  if ('error' in result) {
    if (result.error === 'notfound') return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
    if (result.error === 'noopen') return NextResponse.json({ error: 'Este membro não tem mensalidade vencida em aberto para renegociar.' }, { status: 400 });
    if (result.error === 'locked') {
      return NextResponse.json({ error: `Período encerrado (${result.term.title}) num dos novos vencimentos. Escolha outra data inicial.` }, { status: 409 });
    }
  }

  return NextResponse.json(result);
}
