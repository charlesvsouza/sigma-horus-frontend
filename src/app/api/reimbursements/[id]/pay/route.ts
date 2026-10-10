import { logAudit } from '@/lib/audit';
import { brl } from '@/lib/currency';
import { INVALID_DATE_MESSAGE, parseDateInput, todayBR } from '@/lib/date-only';
import { EXPENSE_RECEIPT_ENTITY } from '@/lib/expense-receipt';
import { checkLedgerOpen } from '@/lib/ledger-lock-server';
import { lockKey } from '@/lib/locks';
import { withTenant } from '@/lib/prisma';
import { getActor, hasTreasuryWrite, sendMails, unauthorized } from '@/lib/reimbursement-server';
import { findClosedTermForDate } from '@/lib/term-lock';
import { buildObjectKey, deleteObject, putObject } from '@/lib/storage';
import { receiptUploadError } from '@/lib/upload-guards';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { NextResponse } from 'next/server';

const METHODS = ['pix', 'transfer', 'cash', 'manual'];

// Pagamento do reembolso autorizado: a Tesouraria devolve o dinheiro ao irmão e registra conta, data e COMPROVANTE
// (obrigatório — PDF ou foto). É aqui, e só aqui, que a conta a pagar vira "paga" e o valor entra no extrato.
// Formulário multipart: bankAccountId, paidAt (AAAA-MM-DD), method, file.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return unauthorized();
  const sub = await requireActiveSubscription(actor.lodgeId);
  if (!sub.ok) return NextResponse.json({ error: sub.error, code: sub.code }, { status: sub.status });
  const access = await hasTreasuryWrite(actor);
  if (!access) return NextResponse.json({ error: 'O pagamento é da Tesouraria.' }, { status: 403 });
  const { id } = await params;

  const form = await request.formData().catch(() => null);
  const bankAccountId = String(form?.get('bankAccountId') ?? '').trim();
  const paidAt = parseDateInput(String(form?.get('paidAt') ?? '')) ?? null;
  const method = String(form?.get('method') ?? 'pix').trim();
  const file = form?.get('file');
  if (!bankAccountId) return NextResponse.json({ error: 'Selecione a conta bancária ou o caixa que pagou o reembolso.' }, { status: 400 });
  if (!paidAt) return NextResponse.json({ error: INVALID_DATE_MESSAGE }, { status: 400 });
  if (paidAt.getTime() > todayBR().getTime()) return NextResponse.json({ error: 'A data do pagamento não pode ser futura.' }, { status: 400 });
  if (!METHODS.includes(method)) return NextResponse.json({ error: 'Forma de pagamento inválida.' }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Anexe o comprovante do pagamento (PDF ou foto): sem ele o reembolso não é baixado.' }, { status: 400 });
  const invalid = receiptUploadError(file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // Confere tudo antes de subir o arquivo; o arquivo sobe antes da gravação (a auditoria cita a chave).
  const pre = await withTenant(actor.lodgeId, async (db) => {
    const r = await db.reimbursement.findFirst({ where: { id, lodgeId: actor.lodgeId }, select: { status: true, accountId: true } });
    if (!r) return { error: 'Pedido não encontrado.', status: 404 } as const;
    if (r.status !== 'approved' || !r.accountId) return { error: 'Só reembolso autorizado e ainda não pago pode ser baixado.', status: 409 } as const;
    return { ok: true } as const;
  });
  if ('error' in pre) return NextResponse.json({ error: pre.error }, { status: pre.status });

  const key = buildObjectKey(file.name, `payment-receipts/${actor.lodgeId}`);
  const stored = await putObject(key, Buffer.from(await file.arrayBuffer()), file.type).catch(() => false);
  if (!stored) return NextResponse.json({ error: 'Não foi possível enviar o comprovante. Tente de novo.' }, { status: 502 });

  let result;
  try {
    result = await withTenant(actor.lodgeId, async (db) => {
      const r = await db.reimbursement.findFirst({ where: { id, lodgeId: actor.lodgeId }, include: { member: { select: { name: true, email: true } } } });
      if (!r || r.status !== 'approved' || !r.accountId) return { error: 'Só reembolso autorizado e ainda não pago pode ser baixado.', status: 409 } as const;
      // Uma baixa por vez por conta (dois cliques seguidos não pagam em dobro).
      await lockKey(db, `account:${r.accountId}`);
      const again = await db.reimbursement.findFirst({ where: { id, lodgeId: actor.lodgeId }, select: { status: true } });
      if (again?.status !== 'approved') return { error: 'Este reembolso já foi baixado.', status: 409 } as const;

      const account = await db.account.findFirst({ where: { id: r.accountId, lodgeId: actor.lodgeId }, select: { id: true, amount: true, status: true } });
      if (!account) return { error: 'A conta a pagar deste reembolso não foi encontrada.', status: 404 } as const;
      if (account.status === 'paid') return { error: 'A conta a pagar deste reembolso já está paga.', status: 409 } as const;
      const bank = await db.financialAccount.findFirst({ where: { id: bankAccountId, lodgeId: actor.lodgeId, active: true }, select: { id: true } });
      if (!bank) return { error: 'Conta bancária/caixa inválida ou inativa.', status: 400 } as const;
      const locked = await findClosedTermForDate(db, actor.lodgeId, paidAt);
      if (locked) return { error: `Período encerrado (${locked.title}). Não é possível registrar pagamento com data dentro de um veneralato já fechado.`, status: 409 } as const;
      const ledger = await checkLedgerOpen(db, actor.lodgeId, [paidAt], { userId: actor.userId, what: 'payment.create' });
      if (!ledger.ok) return { error: ledger.error, status: 409, code: 'LEDGER_LOCKED' } as const;

      const amount = r.approvedAmount ?? r.amount;
      const payment = await db.payment.create({
        data: {
          lodgeId: actor.lodgeId, accountId: account.id, memberId: null, bankAccountId: bank.id, amount, paidAt, method,
          settlementType: 'receipt_check', note: `Reembolso a ${r.member.name}: ${r.description}`.slice(0, 300),
        },
        select: { id: true },
      });
      await db.account.update({ where: { id: account.id }, data: { status: 'paid', bankAccountId: bank.id } });
      await db.reimbursement.update({ where: { id }, data: { status: 'paid', paidAt, paidById: actor.userId } });
      // Comprovante do pagamento: o mesmo registro que as demais despesas usam (aparece em Contas).
      await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'CREATE', entity: EXPENSE_RECEIPT_ENTITY, entityId: account.id, metadata: { receiptKey: key, receiptName: file.name.slice(0, 120), receiptType: file.type, replaced: false, reimbursementId: id } });
      await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'CREATE', entity: 'payment', entityId: payment.id, metadata: { accountId: account.id, amount, method, reimbursementId: id } });
      await logAudit(db, { lodgeId: actor.lodgeId, userId: actor.userId, action: 'UPDATE', entity: 'reimbursement', entityId: id, metadata: { step: 'paid', paymentId: payment.id, bankAccountId: bank.id } });
      const lodge = await db.lodge.findUnique({ where: { id: actor.lodgeId }, select: { name: true } });
      return { r, amount, lodgeName: lodge?.name ?? 'Sua loja' } as const;
    });
  } catch (err) {
    await deleteObject(key).catch(() => {});
    throw err;
  }
  if ('error' in result) {
    await deleteObject(key).catch(() => {});
    return NextResponse.json({ error: result.error, ...('code' in result ? { code: result.code } : {}) }, { status: result.status });
  }

  if (result.r.member.email) {
    await sendMails([result.r.member.email], `Reembolso pago — ${result.lodgeName}`, `Olá, ${result.r.member.name}.\n\nSeu reembolso (${result.r.description}) de ${brl(result.amount)} foi pago pela Tesouraria.\n\n${result.lodgeName}`);
  }
  return NextResponse.json({ success: true });
}
