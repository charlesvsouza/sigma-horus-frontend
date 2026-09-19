import { round2 } from '@/lib/money';

// Modo de recebimento das cobranças — escolha da PRÓPRIA loja (não do sistema):
//  - "lodge": a loja recebe direto na sua conta (chave Pix / TED), baixa manual ou por extrato;
//  - "asaas": recebe pelo Asaas, que repassa (manualmente) para a conta corrente da loja.
// O dinheiro é sempre lançado na conta corrente da loja — nunca numa "conta" do Asaas.

export type CollectionMode = 'lodge' | 'asaas';
export const COLLECTION_MODES: CollectionMode[] = ['lodge', 'asaas'];

export function normalizeCollectionMode(v: unknown): CollectionMode {
  return v === 'asaas' ? 'asaas' : 'lodge';
}

export function isAsaasMode(lodge: { collectionMode?: string | null } | null | undefined): boolean {
  return normalizeCollectionMode(lodge?.collectionMode) === 'asaas';
}

// Cartão fica FORA do Modo Asaas: a API do Asaas não permite excluir o cartão por cobrança
// ("UNDEFINED" deixa o pagador escolher qualquer método habilitado na conta), então a
// emissão é sempre explícita, em Pix ou boleto. O cartão só cairia 32 dias depois.
export type AsaasBillingChoice = 'PIX' | 'BOLETO';
export const ASAAS_BILLING_CHOICES: AsaasBillingChoice[] = ['PIX', 'BOLETO'];

export function normalizeBillingChoice(v: unknown, fallback: AsaasBillingChoice = 'PIX'): AsaasBillingChoice {
  return v === 'PIX' || v === 'BOLETO' ? v : fallback;
}

/** Métodos que a política da loja não prevê (ex.: cartão) — a baixa ainda é feita, mas aparece sinalizada no relatório. */
export function isOutOfPolicyMethod(billingType: string | null | undefined): boolean {
  return !!billingType && billingType !== 'PIX' && billingType !== 'BOLETO';
}

/**
 * Tarifa real do Asaas = valor cobrado − valor líquido informado por ele. Null quando o
 * líquido não veio (não inventa tarifa). Nunca negativa nem maior que o valor.
 */
export function feeFromNet(value: number, netValue: number | null | undefined): number | null {
  if (netValue == null || !Number.isFinite(netValue) || !Number.isFinite(value)) return null;
  const fee = round2(value - netValue);
  if (fee <= 0) return 0;
  return Math.min(fee, round2(value));
}

/** Categoria de despesa onde a tarifa real do Asaas é lançada. */
export const ASAAS_FEE_CHART = {
  code: '2.1.16',
  name: 'Tarifas de Cobrança (Asaas)',
  type: 'EXPENSE' as const,
  category: 'Despesas Administrativas',
};

/**
 * Frase "como pagar" para lembretes de cobrança: no Modo Asaas, o link da cobrança emitida; no Modo Loja,
 * a chave Pix/dados bancários da loja. Vazia quando não há nada a informar.
 */
export function payHint(
  lodge: { collectionMode?: string | null; pixKey?: string | null; bankName?: string | null; bankAgency?: string | null; bankAccount?: string | null } | null | undefined,
  invoice: { asaasInvoiceUrl?: string | null },
): string {
  if (invoice.asaasInvoiceUrl) return ` Pague pelo link: ${invoice.asaasInvoiceUrl}.`;
  if (isAsaasMode(lodge)) return '';
  const ins = paymentInstructions(lodge);
  return ins ? ` Como pagar — ${ins.replace(/\n/g, ' | ')}.` : '';
}

/** Texto de "como pagar" para o Modo Loja (chave Pix e/ou dados bancários da loja). Null se nada cadastrado. */
export function paymentInstructions(lodge: {
  pixKey?: string | null;
  bankName?: string | null;
  bankAgency?: string | null;
  bankAccount?: string | null;
} | null | undefined): string | null {
  if (!lodge) return null;
  const lines: string[] = [];
  if (lodge.pixKey) lines.push(`Pix (chave): ${lodge.pixKey}`);
  const bank = [lodge.bankName, lodge.bankAgency ? `Ag. ${lodge.bankAgency}` : null, lodge.bankAccount ? `Conta ${lodge.bankAccount}` : null].filter(Boolean);
  if (bank.length > 0) lines.push(`Depósito/TED: ${bank.join(' · ')}`);
  return lines.length > 0 ? lines.join('\n') : null;
}
