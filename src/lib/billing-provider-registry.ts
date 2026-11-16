import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { createAsaasProvider } from '@/lib/billing-provider-asaas';
import type { BillingProvider } from '@/lib/billing-provider';

/**
 * Provedor de cobrança da loja, ou null quando a loja ainda não conectou nenhum.
 * Hoje só há o Asaas (chave da própria loja). Um banco (ex.: Itaú) entra aqui como novo adaptador,
 * escolhido por uma coluna da loja — sem mexer na orquestração de `asaas-charge.ts`.
 */
export function resolveBillingProvider(lodge: { asaasApiKeyEnc?: string | null; asaasEnv?: string | null } | null): BillingProvider | null {
  const asaas = buildLodgeAsaasConfig(lodge);
  return asaas ? createAsaasProvider(asaas) : null;
}
