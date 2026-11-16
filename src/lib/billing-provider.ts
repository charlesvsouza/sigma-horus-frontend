// Contrato de um provedor de cobrança (quem emite e cancela cobranças da loja: Asaas hoje; um banco, como o Itaú, no futuro).
// A orquestração (regras da loja, gravação no banco de dados, auditoria) fica em `asaas-charge.ts` e não conhece detalhes do
// provedor: cliente do Asaas, tipo de cobrança, link da cobrança etc. ficam dentro de cada adaptador.

/** Provedores conhecidos. "itau" ainda não tem adaptador (ver `resolveBillingProvider`). */
export type BillingProviderId = 'asaas' | 'itau';

export interface PixQr {
  /** "Pix copia e cola". */
  payload: string;
  /** PNG em base64 (sem o prefixo data:). */
  encodedImage: string;
}

export type BillingMethod = 'PIX' | 'BOLETO';

export interface ProviderEmitInput {
  invoice: { id: string; number: string; description: string | null; dueDate: Date };
  member: { id: string; name: string; email: string | null; phone: string | null; cpf: string; /** Id do irmão no provedor, se já existe. */ providerCustomerId: string | null };
  value: number;
  method: BillingMethod;
  /** Cobrança anterior do mesmo lançamento no provedor: é cancelada antes de emitir a nova (evita pagamento em duplicidade). */
  replaceExternalId: string | null;
}

export interface ProviderEmitOutput {
  /** Id da cobrança no provedor (Asaas: id do pagamento; banco: código da cobrança). */
  externalId: string | null;
  /** Link universal da cobrança (boleto/Pix), quando o provedor tem. */
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  /** Id do irmão criado agora no provedor, para guardar; null quando já existia ou o provedor não usa. */
  newProviderCustomerId: string | null;
  raw: unknown;
}

export interface BillingProvider {
  readonly id: BillingProviderId;
  /** Nome para mensagens ao usuário (ex.: "Asaas"). */
  readonly label: string;
  emit(input: ProviderEmitInput): Promise<ProviderEmitOutput>;
  /** QR do Pix de uma cobrança já emitida; null se o provedor não devolver. */
  fetchPixQr(externalId: string): Promise<PixQr | null>;
}

/** Erro do provedor já em linguagem de gente, com o status HTTP a devolver e o código do provedor (se houver). */
export class BillingProviderError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status = 502, code: string | null = null) {
    super(message);
    this.name = 'BillingProviderError';
    this.status = status;
    this.code = code;
  }
}
