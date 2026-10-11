import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { PAYMENT_PROOF_ENTITY, type ProofRef } from '@/lib/payment-proof';

// Parte com banco do comprovante por baixa (a regra pura está em lib/payment-proof.ts).

/** O mesmo arquivo não vale como comprovante de duas baixas. */
export async function proofKeyUsed(db: Prisma.TransactionClient, lodgeId: string, key: string): Promise<boolean> {
  const row = await db.auditLog.findFirst({ where: { lodgeId, entity: PAYMENT_PROOF_ENTITY, after: { contains: key } }, select: { id: true } });
  return Boolean(row);
}

/** Liga o comprovante ao pagamento (auditoria imutável). */
export async function recordPaymentProof(db: Prisma.TransactionClient, p: { lodgeId: string; userId: string; paymentId: string; accountId: string; ref: ProofRef }): Promise<void> {
  await logAudit(db, {
    lodgeId: p.lodgeId, userId: p.userId, action: 'CREATE', entity: PAYMENT_PROOF_ENTITY, entityId: p.paymentId,
    metadata: { receiptKey: p.ref.key, receiptName: p.ref.name, receiptType: p.ref.type, accountId: p.accountId },
  });
}

export interface PaymentProofMeta { receiptKey: string; receiptName: string; receiptType: string; accountId?: string }

/** Comprovantes (um por pagamento) de uma lista de pagamentos: paymentId → arquivo. */
export async function proofsByPayment(db: Prisma.TransactionClient, lodgeId: string, paymentIds: string[]): Promise<Map<string, PaymentProofMeta>> {
  const out = new Map<string, PaymentProofMeta>();
  if (paymentIds.length === 0) return out;
  const rows = await db.auditLog.findMany({ where: { lodgeId, entity: PAYMENT_PROOF_ENTITY, entityId: { in: paymentIds } }, select: { entityId: true, after: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  for (const r of rows) {
    if (out.has(r.entityId)) continue;
    try {
      const meta = JSON.parse(r.after ?? '{}') as Partial<PaymentProofMeta>;
      if (meta.receiptKey) out.set(r.entityId, { receiptKey: meta.receiptKey, receiptName: meta.receiptName ?? 'comprovante', receiptType: meta.receiptType ?? '', accountId: meta.accountId });
    } catch { /* registro sem metadados legíveis */ }
  }
  return out;
}
