import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { canRequestReimbursement, isEditable, REIMBURSEMENT_LABEL, submitTarget } from '@/lib/reimbursement';
import {
  canActAsStaff, createReimbursementPayable, findDuplicate, findExpenseChart, getActor, reimbursementsLink, sendMails, staffEmails, unauthorized,
} from '@/lib/reimbursement-server';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// Envia o pedido (rascunho ou devolvido). Sem ao menos 1 anexo da nota/recibo, não envia.
//  - Pedido do irmão → vai para a conferência da Tesouraria.
//  - Digitado pela Tesouraria → pula a própria conferência e vai ao Venerável (categoria obrigatória).
//  - Digitado pelo Venerável/Administrador em nome de outro irmão → autorização implícita: nasce aprovado,
//    com a conta a pagar já criada.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return unauthorized();
  const sub = await requireActiveSubscription(actor.lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });
  const { id } = await params;
  const staff = await canActAsStaff(actor);

  const result = await withTenant(actor.lodgeId, async (db) => {
    const r = await db.reimbursement.findFirst({ where: { id, lodgeId: actor.lodgeId }, include: { member: { select: { name: true, email: true, status: true } }, _count: { select: { files: true } } } });
    if (!r) return { error: 'Pedido não encontrado.', status: 404 } as const;
    if (r.requestedByUserId !== actor.userId) return { error: 'Só quem digitou o pedido pode enviá-lo.', status: 403 } as const;
    if (!isEditable(r.status)) return { error: 'Este pedido já foi enviado.', status: 409 } as const;
    if (r._count.files < 1) return { error: 'Anexe a nota ou o recibo (ao menos 1 arquivo) para enviar o pedido.', status: 400 } as const;
    if (!canRequestReimbursement(r.member.status)) return { error: 'Reembolso só para irmão ativo (ou bloqueado por acordo). Fale com a Secretaria.', status: 409 } as const;
    if (r.requestedVia === 'staff' && !staff) return { error: 'Seu acesso não permite registrar reembolso em nome de outro irmão.', status: 403 } as const;

    const target = submitTarget({ via: r.requestedVia === 'staff' ? 'staff' : 'member', role: actor.role, authorIsCreditor: actor.memberId === r.memberId });
    // Quem confirma o pedido em nome da Tesouraria/Venerável também confirma a categoria do gasto.
    const chartAccountId = r.chartAccountId;
    if (target.status !== 'submitted') {
      if (!chartAccountId) return { error: 'Escolha a categoria do gasto antes de enviar.', status: 400 } as const;
      if (!(await findExpenseChart(db, actor.lodgeId, chartAccountId))) return { error: 'Categoria inválida: escolha uma categoria de despesa da loja.', status: 400 } as const;
    }

    const now = new Date();
    const data: Record<string, unknown> = { status: target.status, submittedAt: now, reviewNote: null };
    let accountId: string | null = null;
    if (target.status === 'approved') {
      const made = await createReimbursementPayable(db, actor.lodgeId, { id: r.id, description: r.description, vendorName: r.vendorName, chartAccountId: chartAccountId! }, r.member.name, r.amount);
      if (!made.ok) return { error: made.error, status: 409 } as const;
      accountId = made.accountId;
      Object.assign(data, { decidedById: actor.userId, decidedAt: now, approvedAmount: r.amount, implicitApproval: true, accountId });
    }
    await db.reimbursement.update({ where: { id }, data });
    await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'UPDATE', entity: 'reimbursement', entityId: id, metadata: { step: 'submit', to: target.status, implicit: target.implicit, ...(accountId ? { accountId } : {}) } });

    const duplicate = await findDuplicate(db, actor.lodgeId, r);
    const notify =
      target.status === 'submitted' ? await staffEmails(db, actor.lodgeId, ['treasurer', 'admin'], actor.userId)
      : target.status === 'awaiting_vm' ? await staffEmails(db, actor.lodgeId, ['venerable', 'admin'], actor.userId)
      : await staffEmails(db, actor.lodgeId, ['treasurer', 'admin'], actor.userId);
    const lodge = await db.lodge.findUnique({ where: { id: actor.lodgeId }, select: { name: true } });
    return { target, r, duplicate: Boolean(duplicate), notify, lodgeName: lodge?.name ?? 'Sua loja' } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { target, r, notify, lodgeName } = result;
  const resumo = `${r.member.name} — ${r.description} — ${brl(r.amount)} (gasto de ${formatDateOnly(r.expenseDate)})`;
  const link = reimbursementsLink(true);
  if (target.status === 'submitted') {
    await sendMails(notify, `Pedido de reembolso para conferir — ${r.member.name}`, `Há um pedido de reembolso esperando a conferência da Tesouraria:\n\n${resumo}\n\nConfira a nota ou o recibo e, estando tudo certo, peça a liberação ao Venerável (ou devolva ao irmão para corrigir):\n${link}\n\n${lodgeName}`);
  } else if (target.status === 'awaiting_vm') {
    await sendMails(notify, `Reembolso aguardando sua decisão — ${r.member.name}`, `A Tesouraria registrou um pedido de reembolso que espera a decisão do Venerável:\n\n${resumo}\n\nAbra o pedido, confira a nota e libere ou rejeite (se rejeitar, informe o motivo):\n${link}\n\n${lodgeName}`);
  } else {
    await sendMails(notify, `Reembolso autorizado a pagar — ${r.member.name}`, `Um reembolso foi lançado e autorizado pelo Venerável/Administrador e já está nas contas a pagar:\n\n${resumo}\n\nDevolva o valor ao irmão e registre o pagamento (conta, data e comprovante):\n${link}\n\n${lodgeName}`);
    if (r.member.email) await sendMails([r.member.email], `Seu reembolso foi autorizado — ${lodgeName}`, `Olá, ${r.member.name}.\n\nSeu pedido de reembolso (${r.description}, ${brl(r.amount)}) foi autorizado. A Tesouraria fará a devolução do valor.\n\n${lodgeName}`);
  }
  return NextResponse.json({ success: true, status: target.status, statusLabel: REIMBURSEMENT_LABEL[target.status], ...(result.duplicate ? { warning: 'Atenção: já existe um pedido deste irmão com o mesmo valor e a mesma data do gasto. Confira se não é a mesma nota repetida.' } : {}) });
}
