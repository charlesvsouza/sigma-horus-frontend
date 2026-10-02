import { randomBytes } from 'node:crypto';
import type { AsaasConfig } from '@/lib/asaas';

// Cadastro do webhook de baixa automática no Asaas pela API (Integrações →
// "Registrar webhook no Asaas"). O Asaas exige token de autenticação com pelo
// menos 32 caracteres (tokens curtos, aceitos antes, são recusados no cadastro).

/** Eventos que a rota /api/asaas/webhook trata (só os que o Asaas aceita no cadastro). */
export const WEBHOOK_EVENTS = [
  'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED', 'PAYMENT_DELETED', 'PAYMENT_CHARGEBACK_REQUESTED',
] as const;

export const MIN_WEBHOOK_TOKEN = 32;

/** Token aleatório de 43 caracteres (url-safe). */
export const generateWebhookToken = () => randomBytes(32).toString('base64url');

export interface AsaasWebhook { id: string; url: string; enabled?: boolean; interrupted?: boolean; name?: string }

const headers = (config: AsaasConfig) => ({ 'Content-Type': 'application/json', access_token: config.apiKey });

export async function listWebhooks(config: AsaasConfig): Promise<AsaasWebhook[]> {
  const res = await fetch(`${config.baseUrl}/webhooks?limit=100`, { headers: headers(config) });
  if (!res.ok) throw new Error(`Asaas webhooks ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return Array.isArray(body?.data) ? body.data : [];
}

/** Cria — ou atualiza, se já houver um com a mesma URL — o webhook da loja. */
export async function upsertWebhook(config: AsaasConfig, input: { url: string; email: string; token: string; name: string }): Promise<AsaasWebhook> {
  const existing = (await listWebhooks(config)).find((w) => w.url === input.url);
  const body = {
    name: input.name, url: input.url, email: input.email, enabled: true, interrupted: false,
    apiVersion: 3, authToken: input.token, sendType: 'SEQUENTIALLY', events: [...WEBHOOK_EVENTS],
  };
  const res = await fetch(`${config.baseUrl}/webhooks${existing ? `/${existing.id}` : ''}`, {
    method: existing ? 'PUT' : 'POST',
    headers: headers(config),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { detail = (JSON.parse(text).errors ?? []).map((e: { description?: string }) => e.description).join(' ') || text; } catch { /* texto cru */ }
    throw new Error(detail.slice(0, 300));
  }
  return JSON.parse(text);
}
