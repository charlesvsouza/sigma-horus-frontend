/**
 * Catálogo de bancos para cobrança (Pix e boleto).
 *
 * A ideia é parar de pagar o mesmo custo de programação a cada banco homologado. O que é igual
 * em todo banco fica no código comum (`bacen-pix` para Pix, `billing-provider-*` para a orquestração);
 * o que muda fica AQUI, em uma entrada declarativa: autenticação, endpoints e o que o banco entrega.
 *
 * Para homologar um banco novo, o trabalho passa a ser:
 *   1. uma entrada nesta lista com os endpoints reais (confirmados com a credencial na mão);
 *   2. a função de autenticação dele, se não for OAuth2 com certificado;
 *   3. o corpo do boleto, quando o banco não seguir um padrão.
 * A tela e a API já percorrem esta lista: banco novo não exige mexer em interface.
 *
 * `status: 'planned'` é só registro de intenção — não aparece para o Tesoureiro.
 */

export type BankAuthKind = 'oauth2-mtls' | 'api-key';

export interface BankEndpoints {
  /** Base do OAuth2/STS. */
  tokenBase: string;
  /** Base da API de cobrança. */
  apiBase: string;
  tokenPath: string;
  pixCob: string;
  pixCobQr: string;
  /** null = banco ainda sem boleto implementado. */
  boleto: string | null;
  /** Header de chave de API, quando o contrato exigir (`null` = não enviar). */
  apiKeyHeader: string | null;
}

export interface BankSpec {
  id: string;
  label: string;
  auth: BankAuthKind;
  /** `ready` = pode ser escolhido e usado; `planned` = só intenção registrada. */
  status: 'ready' | 'planned';
  /** Pix no padrão Bacen (contrato comum). */
  pixPadrao: 'bacen';
  boleto: 'proprio' | 'indefinido';
  endpoints?: { production: BankEndpoints; sandbox?: BankEndpoints };
  /** O que falta para virar `ready`, em uma frase (aparece só na documentação). */
  pendencia?: string;
}

const ITAU: BankSpec = {
  id: 'itau',
  label: 'Itaú',
  auth: 'oauth2-mtls',
  status: 'ready',
  pixPadrao: 'bacen',
  boleto: 'proprio',
  endpoints: {
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
  },
};

/**
 * Bancos que ainda não têm integração. Ficam registrados para a conversa comercial não começar
 * do zero: cada um precisa do credenciamento e da confirmação de endpoints com a credencial.
 */
const PLANEJADOS: BankSpec[] = [
  { id: 'bb', label: 'Banco do Brasil', auth: 'oauth2-mtls', status: 'planned', pixPadrao: 'bacen', boleto: 'indefinido', pendencia: 'Credenciamento da API de cobrança e confirmação dos endpoints.' },
  { id: 'bradesco', label: 'Bradesco', auth: 'oauth2-mtls', status: 'planned', pixPadrao: 'bacen', boleto: 'indefinido', pendencia: 'Credenciamento e confirmação do fluxo de boleto (registro e baixa).' },
  { id: 'sicoob', label: 'Sicoob', auth: 'oauth2-mtls', status: 'planned', pixPadrao: 'bacen', boleto: 'indefinido', pendencia: 'Credenciamento por cooperativa; confirmar endpoints por singular.' },
  { id: 'sicredi', label: 'Sicredi', auth: 'api-key', status: 'planned', pixPadrao: 'bacen', boleto: 'indefinido', pendencia: 'Confirmação do modelo de autenticação da API de cobrança.' },
  { id: 'inter', label: 'Banco Inter', auth: 'oauth2-mtls', status: 'planned', pixPadrao: 'bacen', boleto: 'indefinido', pendencia: 'Credenciamento; o Inter já publica API de cobrança com Pix e boleto.' },
];

export const BANCOS: BankSpec[] = [ITAU, ...PLANEJADOS];

/** Bancos que a tela pode oferecer hoje. */
export function bancosProntos(): BankSpec[] {
  return BANCOS.filter((b) => b.status === 'ready');
}

export function bancoPorId(id: string | null | undefined): BankSpec | undefined {
  return BANCOS.find((b) => b.id === id);
}

/** Banco pronto que a tela abre por padrão (hoje, o único homologado). */
export function bancoPadrao(): BankSpec | null {
  return bancosProntos()[0] ?? null;
}
