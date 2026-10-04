import { auth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { ASAAS_CASH_CONFIRMED_ENTITY, ASAAS_CASH_METHOD } from '@/lib/asaas-cash';
import { withTenant } from '@/lib/prisma';
import { requireLodgeAccess } from '@/lib/rbac';
import { findClosedTermForDate } from '@/lib/term-lock';
import { autoSignReceipt } from '@/lib/receipt-signature-server';
import { NextResponse } from 'next/server';

// A Tesouraria confirma um recebimento "em dinheiro" que foi marcado no painel do Asaas: o sistema já
// lançou a baixa no Caixa; aqui ela confere o dinheiro e, se ele foi depositado em outra conta, escolhe a
// conta certa. A confirmação fica na auditoria (quem e quando).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  if (!lodgeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireLodgeAccess(String(lodgeId), session.user.role, 'accounts', 'write');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const chosenBank = body?.bankAccountId ? String(body.bankAccountId) : null;

  const result = await withTenant(String(lodgeId), async (db) => {
    const payment = await db.payment.findFirst({ where: { id, lodgeId: String(lodgeId), method: ASAAS_CASH_METHOD } });
    if (!payment) return { error: 'notfound' } as const;
    const done = await db.auditLog.findFirst({ where: { lodgeId: String(lodgeId), entity: ASAAS_CASH_CONFIRMED_ENTITY, entityId: id }, select: { id: true } });
    if (done) return { error: 'already' } as const;

    const bankId = chosenBank ?? payment.bankAccountId;
    if (!bankId) return { error: 'nobank' } as const;
    const bank = await db.financialAccount.findFirst({ where: { id: bankId, lodgeId: String(lodgeId), active: true }, select: { id: true, name: true } });
    if (!bank) return { error: 'badbank' } as const;

    if (bank.id !== payment.bankAccountId) {
      const locked = await findClosedTermForDate(db, String(lodgeId), payment.paidAt);
      if (locked) return { error: 'locked', title: locked.title } as const;
      await db.payment.update({ where: { id }, data: { bankAccountId: bank.id } });
    }
    // A confirmação do Tesoureiro é a aprovação: o recibo do recebimento em dinheiro é assinado agora.
    await autoSignReceipt(db, String(lodgeId), id, String(session.user.id));
    await logAudit(db, {
      lodgeId: String(lodgeId), userId: String(session.user.id), action: 'UPDATE', entity: ASAAS_CASH_CONFIRMED_ENTITY, entityId: id,
      before: { bankAccountId: payment.bankAccountId }, metadata: { bankAccountId: bank.id, bank: bank.name, amount: payment.amount },
    });
    return { ok: true, bank: bank.name } as const;
  });

  if (!('ok' in result)) {
    const map = {
      notfound: ['Recebimento em dinheiro não encontrado.', 404],
      already: ['Este recebimento já foi confirmado.', 409],
      nobank: ['Escolha a conta que recebeu o dinheiro.', 400],
      badbank: ['Conta bancária/caixa inválida ou inativa.', 400],
      locked: [`Período encerrado (${'title' in result ? result.title : ''}): não dá para trocar a conta de um recebimento dentro de um veneralato fechado.`, 409],
    } as const;
    const [error, status] = map[result.error];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json({ ok: true, bank: result.bank });
}
