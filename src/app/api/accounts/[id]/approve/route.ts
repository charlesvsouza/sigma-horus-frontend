import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { approvalSummary, canApproveExpense, evaluateApprovals, isApproverRole } from '@/lib/expense-approval';
import { loadLauncher, notifyApprovers } from '@/lib/expense-approval-server';
import { withTenant } from '@/lib/prisma';
import { normalizeRole } from '@/lib/rbac';
import { NextResponse } from 'next/server';
import { requireActiveSubscription } from '@/lib/subscription-guard';

// Visto numa despesa que ficou "aguardando aprovação" (valor >= limite configurado em Configurações → Financeiro).
// Só depois disso o Tesoureiro pode registrar o pagamento (ver POST /api/payments).
//  - Sem dupla aprovação: basta o visto do Venerável ou do Administrador (como sempre foi).
//  - Com dupla aprovação (Lodge.expenseDualApproval): duas pessoas diferentes — Venerável e Tesoureiro; quem lançou
//    não aprova; o Administrador ocupa qualquer lugar e, com { "valve": true }, aprova sozinho (Venerável ausente).
//    Ver lib/expense-approval.ts.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = normalizeRole(session?.user?.role);
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const subscription = await requireActiveSubscription(String(lodgeId));
  if (!subscription.ok) return NextResponse.json({ error: subscription.error, code: subscription.code }, { status: subscription.status });

  const body = await request.json().catch(() => ({}));
  const wantsValve = body?.valve === true;
  const { id } = await params;
  const userId = String(session.user.id);

  const result = await withTenant(String(lodgeId), async (db) => {
    const account = await db.account.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!account) return { error: 'notfound' as const };
    if (account.type !== 'PAYABLE') return { error: 'notpayable' as const };
    const lodge = await db.lodge.findUnique({ where: { id: String(lodgeId) }, select: { expenseDualApproval: true, name: true } });

    // Sem dupla aprovação: o visto único de sempre (Venerável ou Administrador).
    if (!lodge?.expenseDualApproval) {
      if (role !== 'venerable' && role !== 'admin') return { error: 'forbidden-single' as const };
      const updated = await db.account.update({ where: { id }, data: { approvalStatus: 'approved' } });
      await logAudit(db, { lodgeId: String(lodgeId), userId, action: 'UPDATE', entity: 'account', entityId: id, metadata: { action: 'approve_expense', amount: account.amount } });
      return { updated, complete: true, summary: 'Aprovada' } as const;
    }

    if (!isApproverRole(role)) return { error: 'forbidden-dual' as const };
    if (account.approvalStatus === 'approved') return { error: 'already' as const };
    const launcher = await loadLauncher(db, String(lodgeId), id);
    const existing = await db.expenseApproval.findMany({ where: { accountId: id, lodgeId: String(lodgeId) }, select: { userId: true, role: true, valve: true } });
    const can = canApproveExpense({ role, userId, launcherUserId: launcher.userId }, existing);
    if (!can.ok) return { error: 'cannot' as const, message: can.error };
    if (wantsValve && !can.valve) return { error: 'cannot' as const, message: 'Só o Administrador pode aprovar sozinho.' };

    await db.expenseApproval.create({ data: { lodgeId: String(lodgeId), accountId: id, userId, role, valve: wantsValve } });
    const rows = [...existing, { userId, role, valve: wantsValve }];
    const state = evaluateApprovals(rows, launcher.userId, { launcherRole: launcher.role });
    const updated = state.complete ? await db.account.update({ where: { id }, data: { approvalStatus: 'approved' } }) : account;
    await logAudit(db, { lodgeId: String(lodgeId), userId, action: 'UPDATE', entity: 'account', entityId: id, metadata: { action: wantsValve ? 'approve_expense_valve' : 'approve_expense', role, amount: account.amount, complete: state.complete } });
    const names = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
    const nameOf = new Map(names.map((n) => [n.id, n.name]));
    const summary = approvalSummary(state, rows.map((r) => ({ name: nameOf.get(r.userId) ?? '—', role: r.role, valve: r.valve })));
    // Ainda falta a outra aprovação: avisa quem pode dar.
    const notify = state.complete ? null : await notifyApprovers(db, String(lodgeId), { id, title: account.title, amount: account.amount, lodgeName: lodge.name }, [launcher.userId, userId]);
    return { updated, complete: state.complete, summary, notify } as const;
  });

  if ('error' in result) {
    switch (result.error) {
      case 'notfound': return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
      case 'notpayable': return NextResponse.json({ error: 'Só contas a pagar passam por aprovação.' }, { status: 400 });
      case 'forbidden-single': return NextResponse.json({ error: 'Apenas o Venerável Mestre ou o Administrador podem aprovar despesas.' }, { status: 403 });
      case 'forbidden-dual': return NextResponse.json({ error: 'Apenas o Venerável Mestre, o Tesoureiro ou o Administrador podem aprovar despesas.' }, { status: 403 });
      case 'already': return NextResponse.json({ error: 'Esta despesa já está aprovada.' }, { status: 409 });
      default: return NextResponse.json({ error: result.message }, { status: 403 });
    }
  }
  if ('notify' in result && result.notify) await result.notify();
  return NextResponse.json({ item: result.updated, complete: result.complete, summary: result.summary });
}
