const BASE_URL = process.env.ASAAS_API_URL ?? 'https://sandbox.asaas.com/api/v3';
const API_KEY = process.env.ASAAS_API_KEY ?? '';

function headers() {
  return {
    'Content-Type': 'application/json',
    access_token: API_KEY,
  };
}

export async function createCustomer(data: { name: string; email: string; cpfCnpj: string; phone?: string }) {
  if (!API_KEY) return null;
  const res = await fetch(`${BASE_URL}/customers`, { method: 'POST', headers: headers(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`Asaas customer error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createPayment(data: {
  customer: string;
  billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD';
  value: number;
  dueDate: string;
  description?: string;
}) {
  if (!API_KEY) return null;
  const res = await fetch(`${BASE_URL}/payments`, { method: 'POST', headers: headers(), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`Asaas payment error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getPayment(id: string) {
  if (!API_KEY) return null;
  const res = await fetch(`${BASE_URL}/payments/${id}`, { headers: headers() });
  if (!res.ok) throw new Error(`Asaas get payment error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listPayments(customerId?: string) {
  if (!API_KEY) return null;
  const params = customerId ? `?customer=${customerId}` : '';
  const res = await fetch(`${BASE_URL}/payments${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`Asaas list payments error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function processWebhook(body: unknown) {
  // Parses Asaas webhook payload — returns typed event
  return body as { event: string; payment?: { id: string; status: string; value: number; customer: string } };
}
