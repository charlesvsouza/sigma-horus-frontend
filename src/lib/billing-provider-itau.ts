import { randomUUID } from 'node:crypto';
import { BillingProviderError, type BillingProvider, type PixQr, type ProviderEmitInput, type ProviderEmitOutput } from '@/lib/billing-provider';
import type { BankCredentials } from '@/lib/bank-credentials';

/**
 * Adaptador do Itaú para o contrato de provedor de cobrança.
 *
 * Estado: PRONTO, esperando credenciais. Nada aqui fala com o banco enquanto a loja não tiver
 * `BankIntegration.status = 'active'` e as quatro credenciais abertas (client_id, client_secret,
 * certificado e chave). Sem isso, `emit` e `fetchPixQr` respondem um erro em linguagem de gente,
 * em vez de estourar 500 no meio da emissão.
 *
 * Três pontos que só a credencial confirma (a documentação do Itaú diverge entre produtos, e o
 * modelo `BankIntegration` já tem a coluna `tokenPath` para registrar qual funcionou):
 *   1. caminho do token (produção x sandbox);
 *   2. nome do header de chave de API, quando o contrato exigir (fica em `endpoints.apiKeyHeader`);
 *   3. caminho do boleto (`/cobranca/v2/boletos` no contrato v2 que usamos).
 * Tudo isso vive em `ITAU_ENDPOINTS`, num lugar só, e nada mais no sistema conhece essas URLs.
 */

export interface ItauEndpoints {
  /** Base do STS (OAuth2). */
  tokenBase: string;
  /** Base da API de cobrança/Pix. */
  apiBase: string;
  tokenPath: string;
  pixCob: string;
  pixCobQr: string;
  boleto: string;
  /** Header de chave de API, quando o contrato exigir. `null` = não enviar. */
  apiKeyHeader: string | null;
}

export const ITAU_ENDPOINTS: Record<'production' | 'sandbox', ItauEndpoints> = {
  production: {
    tokenBase: 'https://sts.itau.com.br',
    apiBase: 'https://api.itau.com.br',
    tokenPath: '/api/oauth/token',
    pixCob: '/pix/v2/cob',
    pixCobQr: '/pix/v2/cob/{txid}/qrcode',
    boleto: '/cobranca/v2/boletos',
    apiKeyHeader: 'x-itau-apikey',
  },
  sandbox: {
    tokenBase: 'https://sts.sandbox.itau.com.br',
    apiBase: 'https://api.sandbox.itau.com.br',
    tokenPath: '/api/oauth/token',
    pixCob: '/pix/v2/cob',
    pixCobQr: '/pix/v2/cob/{txid}/qrcode',
    boleto: '/cobranca/v2/boletos',
    apiKeyHeader: 'x-itau-apikey',
  },
};

export interface ItauConfig {
  env: 'production' | 'sandbox';
  credentials: BankCredentials | null;
  /** Chave Pix da loja que recebe (obrigatória para Pix). */
  pixKey?: string | null;
  /** Chave de API, quando o contrato do Itaú exigir (não é o client_secret). */
  apiKey?: string | null;
  /** Caminho do token já validado (coluna `tokenPath`), quando existir. */
  tokenPath?: string | null;
  endpoints?: Partial<ItauEndpoints>;
}

/** Resposta mínima de transporte, para o adaptador não depender de um cliente HTTP específico. */
export interface ItauResponse {
  status: number;
  body: unknown;
}

/**
 * Transporte HTTP. O Itaú exige TLS mútuo (certificado + chave da loja) em todas as chamadas,
 * inclusive no token — por isso o padrão é `node:https` com `cert`/`key`, e não `fetch`.
 * Os testes trocam esta função por um dublê.
 */
export type ItauTransport = (req: {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  headers: Record<string, string>;
  body?: string;
  certificatePem: string;
  privateKeyPem: string;
}) => Promise<ItauResponse>;

/** txid do Pix: 26 a 35 caracteres alfanuméricos (Bacen), derivado do id da cobrança. */
export function sanitizeTxid(invoiceId: string): string {
  const base = invoiceId.replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 35);
  return base.length >= 26 ? base : base.padEnd(26, '0');
}

/** Data do Itaú é sempre AAAA-MM-DD, no fuso de Brasília. */
export function itauDate(date: Date): string {
  const br = new Date(date.getTime() - 3 * 3_600_000);
  return br.toISOString().slice(0, 10);
}

/** Só CPF/CNPJ em dígitos: o banco recusa pontuação. */
export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

export function buildPixCobBody(input: { value: number; dueDate: Date; description: string | null; txid: string; pixKey: string }): Record<string, unknown> {
  return {
    calendario: { expiracao: 3600 * 24 * 3 },
    valor: { original: input.value.toFixed(2) },
    chave: input.pixKey,
    txid: input.txid,
    solicitacaoPagador: (input.description ?? '').slice(0, 140) || undefined,
  };
}

export function buildBoletoBody(input: {
  value: number; dueDate: Date; invoiceNumber: string; description: string | null;
  member: { name: string; cpf: string; email: string | null; phone: string | null };
}): Record<string, unknown> {
  return {
    etapa_processo_boleto: 'efetivacao',
    beneficiario: { tipo_pessoa: { codigo_tipo_pessoa: 'J' } },
    dado_boleto: {
      tipo_boleto: 'a vista',
      codigo_canal_avac: 'API',
      descricao_instrumento_cobranca: (input.description ?? input.invoiceNumber).slice(0, 100),
      tipo_cobranca: 'simples',
    },
    valor: { valor_total: Number(input.value.toFixed(2)) },
    vencimento: { data_vencimento: itauDate(input.dueDate) },
    pagador: {
      tipo_pessoa: { codigo_tipo_pessoa: onlyDigits(input.member.cpf).length > 11 ? 'J' : 'F' },
      pessoa: {
        nome_pessoa: input.member.name.slice(0, 80),
        tipo_pessoa_cpf: onlyDigits(input.member.cpf).length <= 11 ? { numero_cpf: onlyDigits(input.member.cpf) } : undefined,
        tipo_pessoa_cnpj: onlyDigits(input.member.cpf).length > 11 ? { numero_cnpj: onlyDigits(input.member.cpf) } : undefined,
        email: input.member.email ?? undefined,
        telefone: input.member.phone ? { numero_telefone: onlyDigits(input.member.phone) } : undefined,
      },
      endereco: { nome_logradouro: 'Nao informado', numero_logradouro: 'S/N', bairro: 'Centro', cidade: 'Rio de Janeiro', sigla_uf: 'RJ', cep: '20000000' },
    },
    codigo_carteira: '109',
  };
}

/** Erro de credencial ausente: 409 e mensagem de configuração, não 502. */
export function missingCredentialsError(): BillingProviderError {
  return new BillingProviderError(
    'A integração com o Itaú ainda não tem credenciais. Peça ao Venerável (ou a quem responde pela conta) o client_id, o client_secret e o certificado, e salve em Configurações da loja → Cobrança pelo banco.',
    409,
  );
}

/** Leitura defensiva do JSON do banco (a forma muda entre produtos). */
function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
function texto(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function mensagemDoBanco(body: unknown, status: number): string {
  const b = obj(body);
  const erro = Array.isArray(b.erro) ? obj(b.erro[0]) : {};
  const detalhe = texto(b.detail) ?? texto(b.mensagem) ?? texto(b.message) ?? texto(erro.mensagem) ?? texto(b.title);
  return `${status}${detalhe ? `: ${detalhe.slice(0, 200)}` : ''}`;
}

export function createItauProvider(config: ItauConfig, transport?: ItauTransport): BillingProvider {
  const endpoints: ItauEndpoints = { ...ITAU_ENDPOINTS[config.env], ...(config.endpoints ?? {}) };
  if (config.tokenPath) endpoints.tokenPath = config.tokenPath;

  const enviar = transport ?? httpsTransport;

  async function token(): Promise<string> {
    const cred = config.credentials;
    if (!cred) throw missingCredentialsError();
    const url = `${endpoints.tokenBase}${endpoints.tokenPath}`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: cred.clientId,
      client_secret: cred.clientSecret,
    }).toString();
    const res = await enviar({
      method: 'POST', url,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      certificatePem: cred.certificatePem, privateKeyPem: cred.privateKeyPem,
    });
    const token = (res.body as { access_token?: string } | null)?.access_token;
    if (res.status >= 300 || !token) {
      throw new BillingProviderError(`O Itaú recusou as credenciais (${mensagemDoBanco(res.body, res.status)}). Confira client_id, client_secret e o certificado.`, 502);
    }
    return token;
  }

  async function chamar(method: 'GET' | 'POST' | 'PUT', path: string, body: unknown, accessToken: string): Promise<ItauResponse> {
    const cred = config.credentials!;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'x-itau-correlationID': randomUUID(),
      'x-itau-flowID': randomUUID(),
    };
    if (endpoints.apiKeyHeader && config.apiKey) headers[endpoints.apiKeyHeader] = config.apiKey;
    return enviar({
      method, url: `${endpoints.apiBase}${path}`,
      headers, body: body === undefined ? undefined : JSON.stringify(body),
      certificatePem: cred.certificatePem, privateKeyPem: cred.privateKeyPem,
    });
  }

  return {
    id: 'itau',
    label: 'Itaú',

    async emit(input: ProviderEmitInput): Promise<ProviderEmitOutput> {
      if (!config.credentials) throw missingCredentialsError();
      // Falha de configuração antes de gastar chamada de rede no banco.
      if (input.method === 'PIX' && !config.pixKey) {
        throw new BillingProviderError('Falta a chave Pix da loja para emitir pelo Itaú. Salve em Configurações da loja → Cobrança pelo banco.', 409);
      }
      const accessToken = await token();

      if (input.method === 'BOLETO') {
        const res = await chamar('POST', endpoints.boleto, buildBoletoBody({
          value: input.value, dueDate: input.invoice.dueDate, invoiceNumber: input.invoice.number,
          description: input.invoice.description, member: input.member,
        }), accessToken);
        if (res.status >= 300) throw new BillingProviderError(`O Itaú não gerou o boleto (${mensagemDoBanco(res.body, res.status)}).`, 502);
        const corpo = obj(res.body);
        const dado = obj(corpo.dado_boleto);
        const linha = texto(dado.numero_linha_digitavel) ?? texto(corpo.numero_linha_digitavel) ?? texto(corpo.id);
        const urlBoleto = texto(dado.url_boleto) ?? texto(corpo.url);
        return {
          externalId: linha,
          invoiceUrl: urlBoleto,
          bankSlipUrl: urlBoleto,
          newProviderCustomerId: null,
          raw: res.body,
        };
      }

      const txid = sanitizeTxid(input.invoice.id);
      const res = await chamar('PUT', `${endpoints.pixCob}/${txid}`, buildPixCobBody({
        value: input.value, dueDate: input.invoice.dueDate, description: input.invoice.description,
        txid, pixKey: config.pixKey!,
      }), accessToken);
      if (res.status >= 300) throw new BillingProviderError(`O Itaú não criou a cobrança Pix (${mensagemDoBanco(res.body, res.status)}).`, 502);

      return { externalId: txid, invoiceUrl: null, bankSlipUrl: null, newProviderCustomerId: null, raw: res.body };
    },

    async fetchPixQr(externalId: string): Promise<PixQr | null> {
      if (!config.credentials) throw missingCredentialsError();
      const accessToken = await token();
      const res = await chamar('GET', endpoints.pixCobQr.replace('{txid}', externalId), undefined, accessToken);
      if (res.status >= 300) return null;
      const b = obj(res.body);
      const payload = texto(b.qrcode);
      if (!payload) return null;
      const encodedImage = (texto(b.imagemQrcode) ?? '').replace(/^data:image\/png;base64,/, '');
      return { payload, encodedImage };
    },
  };
}

/**
 * Testa credenciais sem emitir nada: pede o token e devolve o caminho que funcionou.
 * É o que a tela usa no botão "Validar conexão" e no momento de salvar.
 */
export async function validateItauCredentials(
  config: ItauConfig,
  transport?: ItauTransport,
): Promise<{ ok: true; tokenPath: string } | { ok: false; error: string }> {
  const endpoints: ItauEndpoints = { ...ITAU_ENDPOINTS[config.env], ...(config.endpoints ?? {}) };
  if (config.tokenPath) endpoints.tokenPath = config.tokenPath;
  const cred = config.credentials;
  if (!cred) return { ok: false, error: 'Informe client_id, client_secret, certificado e chave privada.' };
  const enviar = transport ?? httpsTransport;
  try {
    const res = await enviar({
      method: 'POST',
      url: `${endpoints.tokenBase}${endpoints.tokenPath}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: cred.clientId, client_secret: cred.clientSecret }).toString(),
      certificatePem: cred.certificatePem,
      privateKeyPem: cred.privateKeyPem,
    });
    const token = texto(obj(res.body).access_token);
    if (res.status >= 300 || !token) {
      return { ok: false, error: `O Itaú recusou as credenciais (${mensagemDoBanco(res.body, res.status)}). Confira client_id, client_secret e o certificado.` };
    }
    return { ok: true, tokenPath: endpoints.tokenPath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha ao falar com o Itaú.' };
  }
}

/**
 * Transporte padrão: `node:https` com certificado e chave da loja (TLS mútuo).
 * O Itaú não aceita a chamada sem o certificado, então `fetch` não serve aqui.
 */
const httpsTransport: ItauTransport = async ({ method, url, headers, body, certificatePem, privateKeyPem }) => {
  const { request } = await import('node:https');
  const { URL } = await import('node:url');
  const target = new URL(url);
  return new Promise<ItauResponse>((resolve, reject) => {
    const req = request(
      {
        method, hostname: target.hostname, path: `${target.pathname}${target.search}`, port: target.port || 443,
        headers: { ...headers, ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) },
        cert: certificatePem, key: privateKeyPem, timeout: 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          const texto = Buffer.concat(chunks).toString('utf8');
          let parsed: unknown = texto;
          try { parsed = JSON.parse(texto); } catch { /* resposta não-JSON fica como texto */ }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('O Itaú não respondeu em 30s.')));
    req.on('error', (err) => reject(new BillingProviderError(`Falha de conexão com o Itaú: ${err.message}`, 502)));
    if (body) req.write(body);
    req.end();
  });
};
