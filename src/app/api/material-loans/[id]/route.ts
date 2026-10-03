import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { isValidMoney, round2 } from '@/lib/money';
import { canConvert, isSupplyKind, needsCatalogManager, removesFromCatalog, SUPPLY_KIND_LABEL, type SupplyKind } from '@/lib/material-supply';
import { createSaleReceivable, removeSaleReceivable } from '@/lib/material-supply-server';
import { NextResponse } from 'next/server';

const STATUSES = ['returned', 'lost'];

// Devolver/marcar como perdido é operação de inventário (Arquiteto pode); apagar o
// registro do histórico exige gestão do cadastro (materials:write).
async function getSessionAndCheck(lodgeId: string | undefined, role: string | undefined, memberId: string | null | undefined, resource: 'inventory' | 'materials') {
  if (!lodgeId) return { error: 'Unauthorized', status: 401 } as const;
  const access = await requireLodgeAccess(String(lodgeId), role, resource, 'write', memberId);
  if (!access.ok) return { error: access.error, status: access.status } as const;
  return { ok: true as const };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const check = await getSessionAndCheck(lodgeId, role, session?.user?.memberId, 'inventory');
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Corpo da requisição inválido: envie um JSON válido.' }, { status: 400 });

  // Alterar a modalidade de um empréstimo em aberto (ex.: o ritual era da Potência).
  if (body?.kind !== undefined) {
    const kind = body.kind as SupplyKind;
    if (!isSupplyKind(kind)) return NextResponse.json({ error: 'Modalidade inválida.' }, { status: 400 });
    if (needsCatalogManager(kind)) {
      const manager = await getSessionAndCheck(lodgeId, role, session?.user?.memberId, 'materials');
      if ('error' in manager) {
        return NextResponse.json({ error: `${SUPPLY_KIND_LABEL[kind]} é registrada por quem cuida do cadastro de materiais (Secretário, Venerável ou Administrador).` }, { status: 403 });
      }
    }
    const unitPrice = round2(Number(body?.unitPrice ?? 0));
    if (kind === 'sale' && !isValidMoney(unitPrice)) {
      return NextResponse.json({ error: 'Informe o valor unitário da venda (maior que zero, até 2 casas decimais).' }, { status: 400 });
    }
    const dueDate = body?.dueDate ? new Date(`${String(body.dueDate).slice(0, 10)}T12:00:00Z`) : new Date();

    const converted = await withTenant(String(lodgeId), async (db) => {
      const loan = await db.materialLoan.findFirst({ where: { id, lodgeId: String(lodgeId) }, include: { material: { select: { name: true } } } });
      if (!loan) return { notFound: true as const };
      if (!canConvert(loan, kind)) return { cannot: true as const };

      let accountId: string | null = null;
      if (kind === 'sale') {
        const sale = await createSaleReceivable(db, { lodgeId: String(lodgeId), memberId: loan.memberId, materialName: loan.material.name, quantity: loan.quantity, unitPrice, dueDate });
        if ('locked' in sale) return { locked: sale.locked };
        accountId = sale.accountId;
      }
      // Era contado como emprestado (fora do disponível); venda/doação tiram a unidade do
      // cadastro de vez. Cedido pela Potência não baixa nada: a unidade nunca foi da loja,
      // e sair do "emprestado" devolve ao disponível o que foi descontado por engano.
      if (removesFromCatalog(kind)) {
        await db.material.update({ where: { id: loan.materialId }, data: { quantity: { decrement: loan.quantity } } });
      }
      const updated = await db.materialLoan.update({
        where: { id },
        data: { kind, status: 'delivered', unitPrice: kind === 'sale' ? unitPrice : null, accountId },
      });
      await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'materialLoan', entityId: id, metadata: { kind, from: 'loan', ...(accountId ? { accountId } : {}) } });
      return { updated };
    });

    if ('notFound' in converted) return NextResponse.json({ error: 'Fornecimento não encontrado.' }, { status: 404 });
    if ('cannot' in converted) return NextResponse.json({ error: `Só um empréstimo ainda com o obreiro pode passar a "${SUPPLY_KIND_LABEL[kind]}".` }, { status: 409 });
    if ('locked' in converted && converted.locked) return NextResponse.json({ error: `O vencimento cai no veneralato encerrado "${converted.locked.title}". Escolha outra data.` }, { status: 409 });
    return NextResponse.json({ item: converted.updated });
  }

  const status = String(body?.status ?? '').trim();
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Status deve ser returned ou lost.' }, { status: 400 });
  }

  const result = await withTenant(String(lodgeId), async (db) => {
    const loan = await db.materialLoan.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!loan) return { notFound: true as const };
    if (loan.kind !== 'loan' || loan.status !== 'issued') return { notIssued: true as const };

    const updated = await db.materialLoan.update({
      where: { id },
      data: { status, returnedAt: new Date(), notes: body?.notes !== undefined ? (String(body.notes).trim() || null) : undefined },
    });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'UPDATE', entity: 'materialLoan', entityId: id, metadata: { status } });
    return { updated };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Fornecimento não encontrado.' }, { status: 404 });
  if ('notIssued' in result) return NextResponse.json({ error: 'Este fornecimento já foi encerrado.' }, { status: 409 });
  return NextResponse.json({ item: result.updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const role = session?.user?.role;
  const check = await getSessionAndCheck(lodgeId, role, session?.user?.memberId, 'materials');
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;

  const result = await withTenant(String(lodgeId), async (db) => {
    const loan = await db.materialLoan.findFirst({ where: { id, lodgeId: String(lodgeId) } });
    if (!loan) return { notFound: true as const };
    // Apagar uma venda desfaz a conta a receber (se ainda não foi paga nem cobrada).
    if (loan.accountId) {
      const removed = await removeSaleReceivable(db, loan.accountId);
      if ('blocked' in removed) return { saleSettled: true as const };
    }
    // Venda/doação tinham tirado a unidade do cadastro: apagar o registro a devolve.
    if (isSupplyKind(loan.kind) && removesFromCatalog(loan.kind)) {
      await db.material.update({ where: { id: loan.materialId }, data: { quantity: { increment: loan.quantity } } });
    }
    await db.materialLoan.delete({ where: { id } });
    await logAudit(db, { lodgeId: String(lodgeId), userId: session!.user.id, action: 'DELETE', entity: 'materialLoan', entityId: id, metadata: {} });
    return { ok: true as const };
  });

  if ('notFound' in result) return NextResponse.json({ error: 'Empréstimo não encontrado.' }, { status: 404 });
  if ('saleSettled' in result) {
    return NextResponse.json({ error: 'A venda já tem pagamento ou cobrança emitida na Tesouraria. Estorne por lá antes de apagar este registro.' }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
