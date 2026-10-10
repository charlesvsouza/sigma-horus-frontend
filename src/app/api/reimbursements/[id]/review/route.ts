import { logAudit } from '@/lib/audit';
import { brl } from '@/lib/currency';
import { withTenant } from '@/lib/prisma';
import { findExpenseChart, getActor, hasTreasuryWrite, reimbursementsLink, sendMails, staffEmails, unauthorized } from '@/lib/reimbursement-server';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// Conferência da Tesouraria sobre o pedido do irmão (estado "enviado"):
//  - action "forward": a nota confere → confirma a categoria do gasto (obrigatória) e pede a liberação ao Venerável.
//  - action "return": falta algo ou há erro → devolve ao irmão para corrigir (motivo obrigatório).
// Quem pediu o reembolso não confere o próprio pedido.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return unauthorized();
  if (!(await hasTreasuryWrite(actor))) return NextResponse.json({ error: 'A conferência é da Tesouraria.' }, { status: 403 });
  const sub = await requireActiveSubscription(actor.lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? '');
  const note = String(body?.note ?? '').trim();
  if (action !== 'forward' && action !== 'return') return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  if (action === 'return' && note.length < 3) return NextResponse.json({ error: 'Explique ao irmão o que precisa corrigir.' }, { status: 400 });

  const result = await withTenant(actor.lodgeId, async (db) => {
    const r = await db.reimbursement.findFirst({ where: { id, lodgeId: actor.lodgeId }, include: { member: { select: { name: true, email: true } } } });
    if (!r) return { error: 'Pedido não encontrado.', status: 404 } as const;
    if (r.status !== 'submitted') return { error: 'Este pedido não está aguardando conferência.', status: 409 } as const;
    if (r.requestedByUserId === actor.userId || (actor.memberId && actor.memberId === r.memberId)) {
      return { error: 'Quem pediu o reembolso não confere o próprio pedido: outro responsável da Tesouraria precisa conferir.', status: 403 } as const;
    }
    const now = new Date();
    const lodge = await db.lodge.findUnique({ where: { id: actor.lodgeId }, select: { name: true } });
    if (action === 'forward') {
      const chartId = String(body?.chartAccountId ?? r.chartAccountId ?? '').trim();
      if (!chartId) return { error: 'Confirme a categoria do gasto antes de pedir a liberação.', status: 400 } as const;
      if (!(await findExpenseChart(db, actor.lodgeId, chartId))) return { error: 'Categoria inválida: escolha uma categoria de despesa da loja.', status: 400 } as const;
      await db.reimbursement.update({ where: { id }, data: { status: 'awaiting_vm', chartAccountId: chartId, reviewedById: actor.userId, reviewedAt: now, reviewNote: note || null } });
      await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'UPDATE', entity: 'reimbursement', entityId: id, metadata: { step: 'review-forward', chartAccountId: chartId } });
      return { r, lodgeName: lodge?.name ?? 'Sua loja', notify: await staffEmails(db, actor.lodgeId, ['venerable', 'admin'], actor.userId) } as const;
    }
    await db.reimbursement.update({ where: { id }, data: { status: 'returned', reviewedById: actor.userId, reviewedAt: now, reviewNote: note } });
    await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'UPDATE', entity: 'reimbursement', entityId: id, metadata: { step: 'review-return', note } });
    return { r, lodgeName: lodge?.name ?? 'Sua loja', notify: [] as string[] } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { r, lodgeName } = result;
  if (action === 'forward') {
    await sendMails(result.notify, `Reembolso aguardando sua decisão — ${r.member.name}`, `A Tesouraria conferiu a nota e pede a sua liberação do reembolso:\n\n${r.member.name} — ${r.description} — ${brl(r.amount)}\n\nAbra o pedido, confira a nota e libere ou rejeite (se rejeitar, informe o motivo):\n${reimbursementsLink(true)}\n\n${lodgeName}`);
  } else if (r.member.email) {
    await sendMails([r.member.email], `Seu pedido de reembolso precisa de correção — ${lodgeName}`, `Olá, ${r.member.name}.\n\nA Tesouraria devolveu o seu pedido de reembolso (${r.description}, ${brl(r.amount)}) para correção:\n\n"${note}"\n\nCorrija e reenvie em ${reimbursementsLink(false)}\n\n${lodgeName}`);
  }
  return NextResponse.json({ success: true });
}
