// "Tipo de baixa": QUEM ou O QUE confirmou o recebimento/pagamento. É diferente da forma
// (Payment.method: pix, dinheiro, cartão…): a forma diz como o dinheiro andou; o tipo de baixa diz
// como a loja ficou sabendo e deu a conta por quitada. Só descritivo — não muda saldo nem relatório de valores.

export type SettlementType = 'asaas_auto' | 'receipt_check' | 'bank_statement' | 'cash' | 'manual_other' | 'import';

export const SETTLEMENT_LABEL: Record<SettlementType, string> = {
  asaas_auto: 'Automática Asaas',
  receipt_check: 'Conferência de comprovante',
  bank_statement: 'Conferência de extrato',
  cash: 'Recebido em mãos / dinheiro',
  manual_other: 'Manual — outro',
  import: 'Importação',
};

/** O que a Tesouraria pode escolher à mão (nos dois modos de cobrança). Automática e Importação só o sistema grava. */
export const SELECTABLE_SETTLEMENTS: SettlementType[] = ['receipt_check', 'bank_statement', 'cash', 'manual_other'];

export const isSettlementType = (v: unknown): v is SettlementType => typeof v === 'string' && v in SETTLEMENT_LABEL;
export const isSelectableSettlement = (v: unknown): v is SettlementType => typeof v === 'string' && (SELECTABLE_SETTLEMENTS as string[]).includes(v);

/** Textos do campo "Observação" que a conferência de comprovante grava (usado só para classificar pagamentos antigos). */
const RECEIPT_NOTE = /conferido pelo comprovante/i;

/** Lançamentos de outros fluxos (doação, custeio, tarifa, estorno): não são "baixa" de conta a receber — ficam sem tipo. */
const NO_TYPE_METHODS = new Set(['donation', 'fund', 'asaas-fee', 'asaas-refund']);

/**
 * Tipo de baixa de um pagamento: o gravado ou, nos antigos/sem tipo, deduzido da forma e da observação.
 * `null` = lançamento que não é baixa (doação, custeio, tarifa, estorno).
 */
export function settlementTypeOf(p: { settlementType?: string | null; method: string; note?: string | null; bankMatched?: boolean }): SettlementType | null {
  if (isSettlementType(p.settlementType)) return p.settlementType;
  if (p.method === 'asaas') return 'asaas_auto';
  if (p.method === 'asaas-cash' || p.method === 'cash') return 'cash';
  if (p.method === 'import') return 'import';
  if (NO_TYPE_METHODS.has(p.method)) return null;
  if (p.note && RECEIPT_NOTE.test(p.note)) return 'receipt_check';
  if (p.bankMatched) return 'bank_statement';
  return 'manual_other';
}

export const settlementLabel = (p: Parameters<typeof settlementTypeOf>[0]): string => {
  const t = settlementTypeOf(p);
  return t ? SETTLEMENT_LABEL[t] : '—';
};

export type SettlementCheck = { ok: true; value: SettlementType } | { ok: false; error: string };

/** Valida o tipo enviado numa baixa MANUAL (obrigatório; Automática Asaas e Importação não se escolhem). */
export function checkManualSettlement(raw: unknown): SettlementCheck {
  if (raw === undefined || raw === null || raw === '') return { ok: false, error: 'Informe o tipo de baixa (como o pagamento foi confirmado).' };
  if (!isSelectableSettlement(raw)) return { ok: false, error: 'Tipo de baixa inválido. Escolha uma das opções da lista.' };
  return { ok: true, value: raw };
}
