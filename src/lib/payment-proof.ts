// Comprovante de pagamento de DESPESA, um por baixa (decisão do dono, 2026-10-10): toda baixa manual de conta a pagar
// precisa de um comprovante (PDF ou foto), sem saída por justificativa escrita. O arquivo sobe antes
// (POST /api/payment-proofs), a baixa leva a referência (`proofKey`, `proofName`, `proofType`) e grava, na mesma
// transação, um registro de auditoria `payment-proof` ligado ao PAGAMENTO — sem coluna nova, como os demais comprovantes.
// Pagamento parcial = duas baixas = dois comprovantes.
export const PAYMENT_PROOF_ENTITY = 'payment-proof';

const PROOF_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

export interface ProofRef { key: string; name: string; type: string }

export const PROOF_REQUIRED_MESSAGE = 'Anexe o comprovante do pagamento (PDF ou foto): toda baixa de despesa precisa dele.';

/** Prefixo do storage privado de comprovantes desta loja. */
export const proofPrefix = (lodgeId: string) => `payment-receipts/${lodgeId}/`;

export type ProofCheck = { ok: true; ref: ProofRef | null } | { ok: false; error: string };

/**
 * Lê a referência do comprovante enviada com a baixa. Ausente = `ref: null` (quem exige decide); presente mas
 * inválida (de outra loja, caminho estranho, tipo fora da lista) = erro, para uma loja nunca apontar o arquivo de outra.
 */
export function readProofRef(lodgeId: string, body: unknown): ProofCheck {
  const b = (body ?? {}) as Record<string, unknown>;
  const key = typeof b.proofKey === 'string' ? b.proofKey.trim() : '';
  if (!key) return { ok: true, ref: null };
  if (!key.startsWith(proofPrefix(lodgeId)) || key.includes('..')) return { ok: false, error: 'Comprovante inválido: envie o arquivo de novo.' };
  const type = typeof b.proofType === 'string' ? b.proofType : '';
  if (!PROOF_TYPES.includes(type)) return { ok: false, error: 'O comprovante precisa ser uma foto (PNG, JPG ou WebP) ou um PDF.' };
  const name = (typeof b.proofName === 'string' && b.proofName.trim() ? b.proofName.trim() : 'comprovante').slice(0, 120);
  return { ok: true, ref: { key, name, type } };
}
