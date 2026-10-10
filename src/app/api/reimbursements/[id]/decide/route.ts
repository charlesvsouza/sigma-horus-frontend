import { logAudit } from '@/lib/audit';
import { brl } from '@/lib/currency';
import { withTenant } from '@/lib/prisma';
import { canDecide, checkApprovedAmount } from '@/lib/reimbursement';
import { createReimbursementPayable, findExpenseChart, getActor, reimbursementsLink, sendMails, staffEmails, unauthorized } from '@/lib/reimbursement-server';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// Decisão do Venerável Mestre (ou do Administrador) sobre o reembolso que a Tesouraria conferiu.
//  - "approve": cria a conta a pagar (já com a categoria, o valor e a descrição do pedido). Pode autorizar valor
//    menor que o da nota, com motivo. O pagamento (conta, data e comprovante) vem depois, pela Tesouraria.
//  - "reject": exige o motivo; o irmão vê o motivo no pedido.
// Quem pediu o reembolso (ou o digitou) não decide sobre ele.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return unauthorized();
  const sub = await requireActiveSubscription(actor.lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? '');
  const note = String(body?.note ?? '').trim();
  if (action !== 'approve' && action !== 'reject') return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  if (action === 'reject' && note.length < 3) return NextResponse.json({ error: 'Informe o motivo da rejeição: o irmão vai ler.' }, { status: 400 });

  const result = await withTenant(actor.lodgeId, async (db) => {
    const r = await db.reimbursement.findFirst({ where: { id, lodgeId: actor.lodgeId }, include: { member: { select: { name: true, email: true } } } });
    if (!r) return { error: 'Pedido não encontrado.', status: 404 } as const;
    const allowed = canDecide({ role: actor.role, userId: actor.userId, memberId: actor.memberId }, r);
    if (!allowed.ok) return { error: allowed.error, status: 403 } as const;
    if (r.status !== 'awaiting_vm') return { error: 'Este pedido não está aguardando a decisão do Venerável.', status: 409 } as const;
    const now = new Date();
    const lodge = await db.lodge.findUnique({ where: { id: actor.lodgeId }, select: { name: true } });
    const lodgeName = lodge?.name ?? 'Sua loja';

    if (action === 'reject') {
      await db.reimbursement.update({ where: { id }, data: { status: 'rejected', decidedById: actor.userId, decidedAt: now, decisionNote: note } });
      await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'UPDATE', entity: 'reimbursement', entityId: id, metadata: { step: 'rejected', note } });
      return { r, lodgeName, approvedAmount: null, notify: [] as string[] } as const;
    }

    const amount = checkApprovedAmount(r.amount, body?.approvedAmount, note);
    if (!amount.ok) return { error: amount.error, status: 400 } as const;
    if (!r.chartAccountId || !(await findExpenseChart(db, actor.lodgeId, r.chartAccountId))) {
      return { error: 'O pedido está sem a categoria do gasto. Devolva à Tesouraria para confirmar a categoria.', status: 409 } as const;
    }
    const made = await createReimbursementPayable(db, actor.lodgeId, { id: r.id, description: r.description, vendorName: r.vendorName, chartAccountId: r.chartAccountId }, r.member.name, amount.value);
    if (!made.ok) return { error: made.error, status: 409 } as const;
    await db.reimbursement.update({ where: { id }, data: { status: 'approved', decidedById: actor.userId, decidedAt: now, decisionNote: note || null, approvedAmount: amount.value, accountId: made.accountId } });
    await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'UPDATE', entity: 'reimbursement', entityId: id, metadata: { step: 'approved', amount: amount.value, requested: r.amount, accountId: made.accountId } });
    return { r, lodgeName, approvedAmount: amount.value, notify: await staffEmails(db, actor.lodgeId, ['treasurer', 'admin'], actor.userId) } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { r, lodgeName, approvedAmount } = result;
  if (approvedAmount === null) {
    if (r.member.email) await sendMails([r.member.email], `Seu pedido de reembolso foi rejeitado — ${lodgeName}`, `Olá, ${r.member.name}.\n\nSeu pedido de reembolso (${r.description}, ${brl(r.amount)}) foi rejeitado pelo Venerável Mestre. Motivo:\n\n"${note}"\n\n${lodgeName}`);
  } else {
    const menor = approvedAmount < r.amount ? ` (autorizado ${brl(approvedAmount)}; motivo: ${note})` : '';
    await sendMails(result.notify, `Reembolso autorizado a pagar — ${r.member.name}`, `O Venerável autorizou um reembolso, que já está nas contas a pagar:\n\n${r.member.name} — ${r.description} — ${brl(approvedAmount)}${menor}\n\nDevolva o valor ao irmão e registre o pagamento (conta, data e comprovante):\n${reimbursementsLink(true)}\n\n${lodgeName}`);
    if (r.member.email) await sendMails([r.member.email], `Seu reembolso foi autorizado — ${lodgeName}`, `Olá, ${r.member.name}.\n\nSeu pedido de reembolso (${r.description}) foi autorizado${approvedAmount < r.amount ? ` no valor de ${brl(approvedAmount)}. Motivo da diferença: ${note}` : ` no valor de ${brl(approvedAmount)}`}. A Tesouraria fará a devolução.\n\n${lodgeName}`);
  }
  return NextResponse.json({ success: true });
}
