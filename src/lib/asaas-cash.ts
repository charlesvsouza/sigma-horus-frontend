// Cobrança marcada como "Recebida em dinheiro" direto no painel do Asaas (status RECEIVED_IN_CASH).
// Não foi o Asaas quem recebeu: o dinheiro foi entregue em mãos (ou o painel foi usado para dar baixa),
// então NÃO cai na conta corrente de repasse. O sistema lança a baixa no CAIXA da loja e a Tesouraria
// confirma (e, se for o caso, troca a conta). Regras puras aqui; o lançamento está em asaas-settlement.

/** Método do Payment que nasceu de "recebido em dinheiro" no painel do Asaas. */
export const ASAAS_CASH_METHOD = 'asaas-cash';
/** Auditoria: baixa aguardando a confirmação da Tesouraria / já confirmada (entityId = id do Payment). */
export const ASAAS_CASH_PENDING_ENTITY = 'asaas-cash-pending';
export const ASAAS_CASH_CONFIRMED_ENTITY = 'asaas-cash-confirmed';

/** O evento do Asaas é um recebimento em dinheiro registrado no painel? */
export const isAsaasCashStatus = (status: string | null | undefined) => status === 'RECEIVED_IN_CASH';

export function asaasCashNote(asaasPaymentId: string): string {
  return `Recebido em dinheiro (baixa no painel do Asaas) — aguardando confirmação da Tesouraria (${asaasPaymentId})`;
}

/**
 * Escolhe o Caixa para onde vai o dinheiro: a conta do tipo "caixa" ativa (a padrão, se houver mais de
 * uma). Sem nenhum caixa, devolve null e o lançamento cai na conta prevista/de repasse — a Tesouraria
 * corrige na confirmação.
 */
export function pickCashAccount<T extends { id: string; kind: string; active: boolean; isDefault: boolean }>(accounts: T[]): T | null {
  const cash = accounts.filter((a) => a.kind === 'cash' && a.active);
  return cash.find((a) => a.isDefault) ?? cash[0] ?? null;
}
