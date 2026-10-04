import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { generateReceiptCode, brDay, hashReceipt, receiptSignerRole, type ReceiptContent } from '@/lib/receipt-signature';

type Db = Prisma.TransactionClient;

/** Conteúdo do recibo de um pagamento, a partir do banco — base do hash que a assinatura grava. */
export async function loadReceiptContent(db: Db, lodgeId: string, paymentId: string): Promise<ReceiptContent | null> {
  const p = await db.payment.findFirst({
    where: { id: paymentId, lodgeId },
    select: {
      id: true, accountId: true, amount: true, paidAt: true, method: true,
      account: { select: { title: true, member: { select: { name: true } } } },
      member: { select: { name: true } },
      lodge: { select: { name: true } },
    },
  });
  if (!p) return null;
  return {
    paymentId: p.id, accountId: p.accountId, lodgeName: p.lodge.name, accountTitle: p.account?.title ?? '—',
    payerName: (p.member ?? p.account?.member)?.name ?? null, amount: Number(p.amount), paidDay: brDay(p.paidAt), method: p.method,
  };
}

export type ReceiptSignResult =
  | { ok: true; code: string; created: boolean }
  | { ok: false; status: number; error: string };

/**
 * Assina o recibo de um pagamento em nome do usuário (Tesoureiro ou Venerável). Idempotente: se o recibo já tem
 * assinatura, devolve a existente. Usada no momento em que o Tesoureiro/Venerável registra ou aprova o pagamento
 * (dentro da mesma transação, com `db` do tenant) e no botão "Assinar recibo".
 */
export async function signPaymentReceipt(
  db: Db,
  lodgeId: string,
  paymentId: string,
  userId: string,
  ip: string | null = null,
): Promise<ReceiptSignResult> {
  const user = await db.user.findFirst({ where: { id: userId, lodgeId }, select: { id: true, name: true, role: true } });
  const signerRole = receiptSignerRole(user?.role);
  if (!user || !signerRole) return { ok: false, status: 403, error: 'Só o Tesoureiro e o Venerável assinam recibos.' };

  const existing = await db.paymentReceiptSignature.findUnique({ where: { paymentId }, select: { code: true } });
  if (existing) return { ok: true, code: existing.code, created: false };

  const content = await loadReceiptContent(db, lodgeId, paymentId);
  if (!content) return { ok: false, status: 404, error: 'Pagamento não encontrado.' };
  const code = generateReceiptCode();
  await db.paymentReceiptSignature.create({
    data: { lodgeId, paymentId, signerUserId: user.id, signerName: user.name, signerRole, contentHash: hashReceipt(content), code, ip: ip?.slice(0, 64) ?? null },
  });
  await logAudit(db, { lodgeId, userId: user.id, action: 'CREATE', entity: 'payment-receipt-signature', entityId: paymentId, metadata: { code, role: signerRole } });
  return { ok: true, code, created: true };
}

/**
 * Assinatura automática no ato do registro/aprovação do pagamento: só se quem age é Tesoureiro ou Venerável (os demais
 * cargos registram sem assinar; o recibo fica "aguardando assinatura" até o Tesoureiro usar o botão). Nunca derruba a
 * operação principal: qualquer falha aqui é só registrada.
 */
export async function autoSignReceipt(db: Db, lodgeId: string, paymentId: string, userId: string | null | undefined): Promise<void> {
  if (!userId || userId.startsWith('system:')) return;
  // SAVEPOINT: um erro de banco aqui abortaria a transação inteira (e o pagamento seria desfeito em silêncio).
  // Com o savepoint, só a assinatura é desfeita e o pagamento segue.
  await db.$executeRawUnsafe('SAVEPOINT receipt_sign');
  try {
    await signPaymentReceipt(db, lodgeId, paymentId, userId);
    await db.$executeRawUnsafe('RELEASE SAVEPOINT receipt_sign');
  } catch (err) {
    await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT receipt_sign').catch(() => {});
    console.error('recibo: falha ao assinar automaticamente', { paymentId, err });
  }
}
