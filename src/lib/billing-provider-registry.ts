import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { createAsaasProvider } from '@/lib/billing-provider-asaas';
import { createBacenPixProvider } from '@/lib/billing-provider-bacen';
import { createItauProvider, type ItauConfig } from '@/lib/billing-provider-itau';
import { bancoPorId, type BankSpec } from '@/lib/bank-catalog';
import { openBankCredentials, type BankCredentials } from '@/lib/bank-credentials';
import type { BillingProvider } from '@/lib/billing-provider';

/**
 * Escolha do provedor de cobrança da loja: banco conectado (ativo) vence o Asaas; sem banco,
 * Asaas; sem nada, nenhum provedor.
 *
 * Banco com adaptador próprio (Itaú, que também emite boleto) usa o adaptador; qualquer outro
 * banco do catálogo entra pelo provedor **padrão Bacen** (Pix), sem código novo por banco.
 */

/** Campos da loja que decidem o provedor (o select de cada consulta precisa trazer estes). */
export interface LodgeBillingRow {
  asaasApiKeyEnc?: string | null;
  asaasEnv?: string | null;
  /** Integrações bancárias da loja (hoje uma; a lista já comporta mais de um banco). */
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

/** A integração bancária da loja (o Itaú é o banco homologado hoje). */
export function bancoIntegradoDe(lodge: LodgeBillingRow | null | undefined) {
  const lista = lodge?.bankIntegrations ?? [];
  // Se a loja tiver mais de um banco no futuro, o primeiro homologado (e ativo) manda.
  return lista.find((b) => b.status === 'active' && bancoPorId(b.provider)?.status === 'ready') ?? lista[0] ?? null;
}

/** Mantido com o nome antigo: a tela e as rotas já usam esta função. */
export function itauIntegrationOf(lodge: LodgeBillingRow | null | undefined) {
  return bancoIntegradoDe(lodge);
}

export interface BancoConfig {
  spec: BankSpec;
  env: 'production' | 'sandbox';
  credentials: BankCredentials;
  pixKey: string | null;
  tokenPath: string | null;
}

/** Config do banco conectado, ou null quando não há o que usar (sem integração, status ≠ active, credencial que não abre). */
export function bancoConfigDe(lodge: LodgeBillingRow | null | undefined): BancoConfig | null {
  const bi = bancoIntegradoDe(lodge);
  if (!bi || bi.status !== 'active') return null;
  const spec = bancoPorId(bi.provider);
  if (!spec || spec.status !== 'ready') return null;
  const credentials = openBankCredentials(bi);
  if (!credentials) return null;
  return {
    spec,
    env: bi.env === 'sandbox' ? 'sandbox' : 'production',
    credentials,
    pixKey: bi.pixKey,
    tokenPath: bi.tokenPath,
  };
}

/** Compatibilidade com o que já existia (config específica do Itaú). */
export function itauConfigFrom(lodge: LodgeBillingRow | null | undefined): ItauConfig | null {
  const c = bancoConfigDe(lodge);
  if (!c || c.spec.id !== 'itau') return null;
  return { env: c.env, credentials: c.credentials, pixKey: c.pixKey, tokenPath: c.tokenPath };
}

export function resolveBillingProvider(lodge: LodgeBillingRow | null): BillingProvider | null {
  const banco = bancoConfigDe(lodge);
  if (banco) {
    if (banco.spec.id === 'itau') {
      return createItauProvider({ env: banco.env, credentials: banco.credentials, pixKey: banco.pixKey, tokenPath: banco.tokenPath });
    }
    // Demais bancos: Pix padrão Bacen, dirigido pelo catálogo.
    return createBacenPixProvider(banco.spec, {
      env: banco.env,
      credentials: banco.credentials,
      pixKey: banco.pixKey,
    });
  }
  const asaas = buildLodgeAsaasConfig(lodge);
  return asaas ? createAsaasProvider(asaas) : null;
}

export interface ProviderSummary {
  id: string | null;
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
  const bi = bancoIntegradoDe(lodge);
  if (bi) {
    const spec = bancoPorId(bi.provider);
    const label = spec ? (bi.env === 'sandbox' ? `${spec.label} (homologação)` : spec.label) : bi.provider;
    if (bi.status === 'active' && bancoConfigDe(lodge)) return { id: bi.provider, label, ready: true, reason: null };
    const motivo =
      bi.status === 'pending'
        ? `Integração com o ${spec?.label ?? 'banco'} aguardando credenciais (client_id, client_secret e certificado).`
        : bi.status === 'error'
          ? `A última validação com o ${spec?.label ?? 'banco'} falhou. Revise as credenciais e o certificado.`
          : `Integração com o ${spec?.label ?? 'banco'} desligada.`;
    return { id: bi.provider, label, ready: false, reason: motivo };
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
