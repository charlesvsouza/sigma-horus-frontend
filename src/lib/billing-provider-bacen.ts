import { BillingProviderError, type BillingProvider, type PixQr, type ProviderChargeStatus, type ProviderEmitInput, type ProviderEmitOutput } from '@/lib/billing-provider';
import type { BankCredentials } from '@/lib/bank-credentials';
import type { BankSpec } from '@/lib/bank-catalog';
import { buscarQrPix, criarCobrancaPix, mapearCobrancaPix, mensagemDoBanco, sanitizeTxid } from '@/lib/bacen-pix';

/**
 * Provedor de cobrança para QUALQUER banco com Pix no padrão do Bacen.
 *
 * O Pix é padronizado: mesma cobrança imediata (`PUT /pix/v2/cob/{txid}`), mesmo QR, mesmo
 * formato de recebido (`pix[]` com `endToEndId`, `valor`, `horario`). O que muda de banco para
 * banco é só o **endereço** e a **autenticação** — e os dois já estão declarados no
 * `bank-catalog`. Este módulo lê a declaração e fala o padrão.
 *
 * Limite honesto: **boleto não é padronizado**. Banco sem adaptador próprio atende Pix por aqui
 * e recusa boleto com mensagem clara, em vez de emitir errado. Quando o boleto for necessário,
 * escreve-se só a parte do boleto — o Pix já está pronto.
 */

export interface BacenProviderConfig {
  /** Credenciais da loja (client_id/secret + certificado) ou null enquanto não houver. */
  credentials: BankCredentials | null;
  env: 'production' | 'sandbox';
  pixKey?: string | null;
  /** Chave de API, quando a autenticação do banco for por header estático. */
  apiKey?: string | null;
}

/** Resposta mínima de transporte (mesma forma usada pelos adaptadores). */
export interface BacenResponse {
  status: number;
  body: unknown;
}

export type BacenTransport = (req: {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  headers: Record<string, string>;
  body?: string;
  certificatePem?: string;
  privateKeyPem?: string;
}) => Promise<BacenResponse>;

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}
function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

/** Transporte padrão: `node:https` com certificado e chave (TLS mútuo), quando o banco exigir. */
const httpsTransport: BacenTransport = async ({ method, url, headers, body, certificatePem, privateKeyPem }) => {
  const { request } = await import('node:https');
  const { URL } = await import('node:url');
  const target = new URL(url);
  return new Promise<BacenResponse>((resolve, reject) => {
    const req = request(
      {
        method,
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        port: target.port || 443,
        headers: { ...headers, ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) },
        ...(certificatePem && privateKeyPem ? { cert: certificatePem, key: privateKeyPem } : {}),
        timeout: 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          const textoResp = Buffer.concat(chunks).toString('utf8');
          let parsed: unknown = textoResp;
          try { parsed = JSON.parse(textoResp); } catch { /* resposta não-JSON fica como texto */ }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('O banco não respondeu em 30s.')));
    req.on('error', (err) => reject(new BillingProviderError(`Falha de conexão com o banco: ${err.message}`, 502)));
    if (body) req.write(body);
    req.end();
  });
};

function semCredenciais(label: string): BillingProviderError {
  return new BillingProviderError(
    `A integração com o ${label} ainda não tem credenciais. Peça ao Venerável o client_id, o client_secret e o certificado, e salve em Configurações da loja → Cobrança pelo banco.`,
    409,
  );
}

export function createBacenPixProvider(spec: BankSpec, config: BacenProviderConfig, transport?: BacenTransport): BillingProvider {
  const endpoints = spec.endpoints?.[config.env];
  if (!endpoints) throw new BillingProviderError(`O ${spec.label} não tem endpoints de ${config.env} no catálogo.`, 500);
  const enviar = transport ?? httpsTransport;

  async function autenticar(): Promise<{ authorization: string; headers: Record<string, string> }> {
    const cred = config.credentials;
    if (spec.auth === 'api-key') {
      if (!config.apiKey) throw semCredenciais(spec.label);
      return { authorization: '', headers: { 'x-api-key': config.apiKey } };
    }
    if (!cred) throw semCredenciais(spec.label);
    const res = await enviar({
      method: 'POST',
      url: `${endpoints!.tokenBase}${endpoints!.tokenPath}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: cred.clientId, client_secret: cred.clientSecret }).toString(),
      certificatePem: cred.certificatePem,
      privateKeyPem: cred.privateKeyPem,
    });
    const token = texto(obj(res.body).access_token);
    if (res.status >= 300 || !token) {
      throw new BillingProviderError(
        `O ${spec.label} recusou as credenciais (${mensagemDoBanco(res.body, res.status)}). Confira client_id, client_secret e o certificado.`,
        502,
      );
    }
    const headers: Record<string, string> = {};
    if (endpoints!.apiKeyHeader && config.apiKey) headers[endpoints!.apiKeyHeader] = config.apiKey;
    return { authorization: `Bearer ${token}`, headers };
  }

  return {
    id: spec.id,
    label: spec.label,

    async emit(input: ProviderEmitInput): Promise<ProviderEmitOutput> {
      if (input.method === 'BOLETO') {
        throw new BillingProviderError(
          `O ${spec.label} ainda não emite boleto pelo Sigma; por enquanto emita Pix ou use o Asaas.`,
          409,
        );
      }
      if (!config.pixKey) {
        throw new BillingProviderError('Falta a chave Pix da loja para emitir pelo banco. Salve em Configurações da loja → Cobrança pelo banco.', 409);
      }
      const { authorization, headers } = await autenticar();
      const chamar = async (method: 'GET' | 'PUT' | 'POST', path: string, body?: unknown) =>
        enviar({
          method,
          url: `${endpoints!.apiBase}${path}`,
          headers: { 'Content-Type': 'application/json', Authorization: authorization, ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
          ...(config.credentials ? { certificatePem: config.credentials.certificatePem, privateKeyPem: config.credentials.privateKeyPem } : {}),
        });

      const criada = await criarCobrancaPix(
        chamar,
        endpoints!.pixCob,
        { value: input.value, description: input.invoice.description, pixKey: config.pixKey, txid: sanitizeTxid(input.invoice.id) },
        `O ${spec.label}`,
      );
      if (!criada.ok) throw new BillingProviderError(criada.error, criada.status);
      return { externalId: criada.txid, invoiceUrl: null, bankSlipUrl: null, newProviderCustomerId: null, raw: criada.raw };
    },

    async fetchPixQr(externalId: string): Promise<PixQr | null> {
      const { authorization, headers } = await autenticar();
      const chamar = async (method: 'GET' | 'PUT' | 'POST', path: string, body?: unknown) =>
        enviar({
          method,
          url: `${endpoints!.apiBase}${path}`,
          headers: { 'Content-Type': 'application/json', Authorization: authorization, ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
          ...(config.credentials ? { certificatePem: config.credentials.certificatePem, privateKeyPem: config.credentials.privateKeyPem } : {}),
        });
      return buscarQrPix(chamar, endpoints!.pixCobQr, externalId);
    },

    async fetchCharge(externalId: string): Promise<ProviderChargeStatus | null> {
      const { authorization, headers } = await autenticar();
      const res = await enviar({
        method: 'GET',
        url: `${endpoints!.apiBase}${endpoints!.pixCob}/${externalId}`,
        headers: { 'Content-Type': 'application/json', Authorization: authorization, ...headers },
        ...(config.credentials ? { certificatePem: config.credentials.certificatePem, privateKeyPem: config.credentials.privateKeyPem } : {}),
      });
      if (res.status >= 300) return null;
      return mapearCobrancaPix(res.body);
    },
  };
}
