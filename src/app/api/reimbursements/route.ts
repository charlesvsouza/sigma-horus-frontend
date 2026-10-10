import { logAudit } from '@/lib/audit';
import { todayBR } from '@/lib/date-only';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { canRequestReimbursement, checkReimbursementInput } from '@/lib/reimbursement';
import { canActAsStaff, findExpenseChart, getActor, unauthorized } from '@/lib/reimbursement-server';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

// Cria o PEDIDO DE REEMBOLSO como rascunho (ainda sem anexo, invisível para a Tesouraria). Os anexos sobem um a um
// em /files e o pedido só passa a valer depois de POST /submit (que exige ao menos 1 anexo) — o limite de corpo
// do Vercel (~4,5 MB) não comportaria 3 arquivos numa requisição só.
//  - Sem `memberId`: o próprio irmão (portal).
//  - Com `memberId`: a Tesouraria ou o Venerável/Administrador digitando em nome do irmão.
export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor) return unauthorized();
  const sub = await requireActiveSubscription(actor.lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });

  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });

  const onBehalf = Boolean(body?.memberId) && String(body.memberId) !== actor.memberId;
  const targetMemberId = body?.memberId ? String(body.memberId) : actor.memberId;
  if (!targetMemberId) return NextResponse.json({ error: 'Seu acesso não está ligado a um cadastro de irmão. Peça à Secretaria para vincular.' }, { status: 400 });

  if (body?.memberId) {
    if (!(await canActAsStaff(actor))) return NextResponse.json({ error: 'Só a Tesouraria ou o Venerável registram reembolso em nome de outro irmão.' }, { status: 403 });
  } else {
    const access = await requireLodgeAccess(actor.lodgeId, actor.role, 'portal', 'write');
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const input = checkReimbursementInput(body, todayBR());
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const result = await withTenant(actor.lodgeId, async (db) => {
    const member = await db.member.findFirst({ where: { id: targetMemberId, lodgeId: actor.lodgeId }, select: { id: true, status: true } });
    if (!member) return { error: 'Irmão não encontrado nesta loja.', status: 404 } as const;
    if (!canRequestReimbursement(member.status)) return { error: 'Reembolso só para irmão ativo (ou bloqueado por acordo). Fale com a Secretaria.', status: 409 } as const;
    if (input.value.chartAccountId && !(await findExpenseChart(db, actor.lodgeId, input.value.chartAccountId))) {
      return { error: 'Categoria inválida: escolha uma categoria de despesa da loja.', status: 400 } as const;
    }
    const created = await db.reimbursement.create({
      data: {
        lodgeId: actor.lodgeId,
        memberId: member.id,
        requestedByUserId: actor.userId,
        requestedVia: onBehalf ? 'staff' : 'member',
        status: 'draft',
        ...input.value,
      },
      select: { id: true },
    });
    await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'CREATE', entity: 'reimbursement', entityId: created.id, metadata: { step: 'draft', memberId: member.id, amount: input.value.amount, via: onBehalf ? 'staff' : 'member' } });
    return { id: created.id } as const;
  });

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ id: result.id });
}
