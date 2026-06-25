import { asaasBaseUrl, type AsaasConfig } from '@/lib/asaas';
import { decryptSecret } from '@/lib/crypto';

/**
 * Monta a config do Asaas a partir da loja (BYO-key): cada tenant usa a própria
 * conta, com a chave salva (criptografada) pelo próprio painel de Integrações —
 * sem redeploy. Retorna null se a loja ainda não conectou o Asaas.
 */
export function buildLodgeAsaasConfig(lodge: { asaasApiKeyEnc?: string | null; asaasEnv?: string | null } | null): AsaasConfig | null {
  if (!lodge?.asaasApiKeyEnc) return null;
  const apiKey = decryptSecret(lodge.asaasApiKeyEnc);
  if (!apiKey) return null;
  return { apiKey, baseUrl: asaasBaseUrl(lodge.asaasEnv) };
}
