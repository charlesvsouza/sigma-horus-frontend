import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { createAsaasProvider } from '@/lib/billing-provider-asaas';
import { createItauProvider, type ItauConfig } from '@/lib/billing-provider-itau';
import { openBankCredentials } from '@/lib/bank-credentials';
import type { BillingProvider, BillingProviderId } from '@/lib/billing-provider';

/**
 * Escolha do provedor de cobrança da loja. A ordem é: banco conectado (Itaú) vence; senão Asaas;
 * senão nenhum. A orquestração (`asaas-charge.ts`) não sabe qual dos dois respondeu.
 */

/** Campos da loja que decidem o provedor (o select de cada consulta precisa trazer estes). */
export interface LodgeBillingRow {
  asaasApiKeyEnc?: string | null;
  asaasEnv?: string | null;
  /** Relação da loja (pode haver mais de um banco no futuro; usamos a do Itaú). */
  bankIntegrations?: Array<{
    provider: string;
    env: string;
    status: string;
    clientIdEnc: string | null;
    clientSecretEnc: string | null;
    certificateEnc: string | null;
    privateKeyEnc: string | null;
    pixKey: string | null;
    tokenPath: string | null;
    certNotAfter?: Date | null;
    lastCheckAt?: Date | null;
    lastError?: string | null;
  }> | null;
}

/**
 * Config do Itaú, ou null quando não há o que usar: sem integração, com status diferente de
 * `active` (pending/error/disabled) ou com credencial que não abre. É este null que faz a tela
 * dizer "aguardando credenciais" em vez de estourar na emissão.
 */
export function itauIntegrationOf(lodge: LodgeBillingRow | null | undefined) {
  return (lodge?.bankIntegrations ?? []).find((b) => b.provider === 'itau') ?? null;
}

export function itauConfigFrom(lodge: LodgeBillingRow | null | undefined): ItauConfig | null {
  const bi = itauIntegrationOf(lodge);
  if (!bi || bi.provider !== 'itau' || bi.status !== 'active') return null;
  const credentials = openBankCredentials(bi);
  if (!credentials) return null;
  return {
    env: bi.env === 'sandbox' ? 'sandbox' : 'production',
    credentials,
    pixKey: bi.pixKey,
    tokenPath: bi.tokenPath,
  };
}

export function resolveBillingProvider(lodge: LodgeBillingRow | null): BillingProvider | null {
  const itau = itauConfigFrom(lodge);
  if (itau) return createItauProvider(itau);
  const asaas = buildLodgeAsaasConfig(lodge);
  return asaas ? createAsaasProvider(asaas) : null;
}

export interface ProviderSummary {
  id: BillingProviderId | null;
  label: string;
  /** Emite cobrança hoje? */
  ready: boolean;
  /** Por que não emite, em linguagem de gente (para a tela de configuração). */
  reason: string | null;
}

/**
 * Resumo para a tela de Integrações: diz qual provedor está no comando e, quando é o banco,
 * se falta credencial, se está em erro ou se foi desligado. Não abre nem devolve credencial.
 */
export function billingProviderSummary(lodge: LodgeBillingRow | null): ProviderSummary {
  const bi = itauIntegrationOf(lodge);
  if (bi && bi.provider === 'itau') {
    if (bi.status === 'active' && itauConfigFrom(lodge)) {
      return { id: 'itau', label: itauLabel(bi.env), ready: true, reason: null };
    }
    const motivo =
      bi.status === 'pending'
        ? 'Integração com o Itaú aguardando credenciais (client_id, client_secret e certificado).'
        : bi.status === 'error'
          ? 'A última validação com o Itaú falhou. Revise as credenciais e o certificado.'
          : 'Integração com o Itaú desligada.';
    return { id: 'itau', label: itauLabel(bi.env), ready: false, reason: motivo };
  }
  const asaas = buildLodgeAsaasConfig(lodge);
  if (asaas) return { id: 'asaas', label: 'Asaas', ready: true, reason: null };
  return {
    id: null,
    label: 'Nenhum',
    ready: false,
    reason: 'Nenhum provedor de cobrança conectado. Conecte o Asaas ou o banco em Configurações da loja.',
  };
}

function itauLabel(env: string): string {
  return env === 'sandbox' ? 'Itaú (homologação)' : 'Itaú';
}
