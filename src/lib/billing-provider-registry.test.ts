import test from 'node:test';
import assert from 'node:assert/strict';
import { sealBankCredentials } from './bank-credentials.ts';
import { resolveBillingProvider, billingProviderSummary, itauConfigFrom } from './billing-provider-registry.ts';

process.env.ENCRYPTION_KEY ??= 'chave-de-teste-com-tamanho-suficiente';

const selada = sealBankCredentials({
  clientId: 'client-id-123',
  clientSecret: 'client-secret-456',
  certificatePem: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
  privateKeyPem: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----',
});

function integracao(over: Partial<Record<string, unknown>> = {}) {
  return {
    provider: 'itau', env: 'production', status: 'active',
    pixKey: 'loja@exemplo.com', tokenPath: null,
    clientIdEnc: selada.clientIdEnc, clientSecretEnc: selada.clientSecretEnc,
    certificateEnc: selada.certificateEnc, privateKeyEnc: selada.privateKeyEnc,
    ...over,
  };
}

test('sem nada conectado: nenhum provedor e motivo claro', () => {
  const lodge = { asaasApiKeyEnc: null, asaasEnv: null, bankIntegrations: [] };
  assert.equal(resolveBillingProvider(lodge), null);
  const s = billingProviderSummary(lodge);
  assert.equal(s.id, null);
  assert.equal(s.ready, false);
  assert.match(s.reason ?? '', /Nenhum provedor/i);
});

test('integração pendente não emite e explica que faltam credenciais', () => {
  const lodge = { asaasApiKeyEnc: null, asaasEnv: null, bankIntegrations: [integracao({ status: 'pending', clientIdEnc: null })] };
  assert.equal(resolveBillingProvider(lodge), null);
  const s = billingProviderSummary(lodge);
  assert.equal(s.id, 'itau');
  assert.equal(s.ready, false);
  assert.match(s.reason ?? '', /aguardando credenciais/i);
});

test('integração ativa com credenciais: provedor é o Itaú', () => {
  const lodge = { asaasApiKeyEnc: null, asaasEnv: null, bankIntegrations: [integracao()] };
  const provider = resolveBillingProvider(lodge);
  assert.equal(provider?.id, 'itau');
  const s = billingProviderSummary(lodge);
  assert.equal(s.ready, true);
  assert.equal(s.label, 'Itaú');
  assert.equal(itauConfigFrom(lodge)?.pixKey, 'loja@exemplo.com');
});

test('integração ativa mas sem certificado cai para o Asaas, se houver', () => {
  const lodge = {
    asaasApiKeyEnc: selada.clientSecretEnc, // qualquer valor cifrado válido serve como chave do Asaas
    asaasEnv: 'production',
    bankIntegrations: [integracao({ certificateEnc: null })],
  };
  const provider = resolveBillingProvider(lodge);
  assert.equal(provider?.id, 'asaas');
  const s = billingProviderSummary(lodge);
  assert.equal(s.id, 'itau');
  assert.equal(s.ready, false);
});

test('status error pede revisão das credenciais', () => {
  const s = billingProviderSummary({ asaasApiKeyEnc: null, asaasEnv: null, bankIntegrations: [integracao({ status: 'error' })] });
  assert.equal(s.ready, false);
  assert.match(s.reason ?? '', /validação com o Itaú falhou/i);
});

test('integração desligada diz que está desligada', () => {
  const s = billingProviderSummary({ asaasApiKeyEnc: null, asaasEnv: null, bankIntegrations: [integracao({ status: 'disabled' })] });
  assert.match(s.reason ?? '', /desligada/i);
});

test('sandbox aparece como homologação na tela', () => {
  const s = billingProviderSummary({ asaasApiKeyEnc: null, asaasEnv: null, bankIntegrations: [integracao({ env: 'sandbox' })] });
  assert.match(s.label, /homologação/i);
});
