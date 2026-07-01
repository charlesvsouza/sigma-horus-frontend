const PROD_URL = 'https://api.asaas.com/v3';
const SANDBOX_URL = 'https://sandbox.asaas.com/api/v3';

export type AsaasConfig = { apiKey: string; baseUrl: string };

export function asaasBaseUrl(env?: string | null) {
  return env === 'production' ? PROD_URL : SANDBOX_URL;
}

function headers(config: AsaasConfig) {
  return {
    'Content-Type': 'application/json',
    access_token: config.apiKey,
  };
}

export async function createCustomer(config: AsaasConfig, data: { name: string; email?: string; cpfCnpj: string; phone?: string }) {
  const res = await fetch(`${config.baseUrl}/customers`, { method: 'POST', headers: headers(config), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`Asaas customer error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createPayment(config: AsaasConfig, data: {
  customer: string;
  billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
  value: number;
  dueDate: string;
  description?: string;
  /** Liga a cobrança a um registro local (Invoice.id). Volta no webhook como `payment.externalReference`. */
  externalReference?: string;
}) {
  const res = await fetch(`${config.baseUrl}/payments`, { method: 'POST', headers: headers(config), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`Asaas payment error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getPayment(config: AsaasConfig, id: string) {
  const res = await fetch(`${config.baseUrl}/payments/${id}`, { headers: headers(config) });
  if (!res.ok) throw new Error(`Asaas get payment error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listPayments(config: AsaasConfig, customerId?: string) {
  const params = customerId ? `?customer=${customerId}` : '';
  const res = await fetch(`${config.baseUrl}/payments${params}`, { headers: headers(config) });
  if (!res.ok) throw new Error(`Asaas list payments error: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Valida a chave fazendo uma chamada leve à API (lista 1 cobrança). Lança em erro de auth. */
export async function validateApiKey(config: AsaasConfig) {
  const res = await fetch(`${config.baseUrl}/payments?limit=1`, { headers: headers(config) });
  if (res.status === 401) throw new Error('Chave Asaas inválida (401).');
  if (!res.ok) throw new Error(`Asaas error: ${res.status}`);
  return true;
}

export type AsaasWebhookEvent = {
  event: string;
  payment?: {
    id: string;
    status: string;
    value: number;
    customer: string;
    /** Eco do Invoice.id que enviamos em createPayment — usado para a baixa automática. */
    externalReference?: string | null;
    billingType?: string;
  };
};

export function processWebhook(body: unknown): AsaasWebhookEvent {
  // Parses Asaas webhook payload — returns typed event
  return body as AsaasWebhookEvent;
}

/**
 * Asaas autentica o webhook por um token configurável enviado no header
 * `asaas-access-token` (não há assinatura HMAC como no Stripe). Compara o token
 * recebido contra o token armazenado da loja dona da cobrança.
 * - Sem token armazenado → recusa (segurança: não aceita webhook sem token).
 * - Token inválido → recusa.
 */
export function isWebhookAuthorized(received: string | null, expected: string | null | undefined) {
  if (!expected) {
    console.warn('[Asaas] Webhook recebido mas loja não configurou token de validação. Rejeitado.');
    return false;
  }
  if (!received) return false;
  return received === expected;
}
