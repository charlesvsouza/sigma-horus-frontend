import test from 'node:test';
import assert from 'node:assert/strict';
import { createAsaasProvider } from './billing-provider-asaas.ts';
import { BillingProviderError, type ProviderEmitInput } from './billing-provider.ts';
import { asaasDueDate } from './asaas-due-date.ts';

type Call = { method: string; url: string; body: unknown };

/** Troca o fetch por um servidor falso do Asaas; `routes` devolve [status, corpo] por "MÉTODO /caminho". */
function fakeAsaas(routes: Record<string, [number, unknown]>) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : null });
    const path = new URL(url).pathname.replace(/^\/api\/v3/, '').replace(/^\/v3/, '');
    const hit = routes[`${method} ${path}`];
    if (!hit) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(hit[1]), { status: hit[0], headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const config = { apiKey: 'k', baseUrl: 'https://asaas.invalid/v3' };

function input(over: Partial<ProviderEmitInput> = {}, member: Partial<ProviderEmitInput['member']> = {}): ProviderEmitInput {
  return {
    invoice: { id: 'inv1', number: 'COB-1', description: null, dueDate: new Date('2999-01-05T00:00:00Z') },
    member: { id: 'm1', name: 'Irmão', email: null, phone: null, cpf: '12345678909', providerCustomerId: null, ...member },
    value: 220,
    method: 'PIX',
    replaceExternalId: null,
    ...over,
  };
}

test('emite criando o cliente e devolve o id novo para guardar', async () => {
  const f = fakeAsaas({
    'POST /customers': [200, { id: 'cus_1' }],
    'POST /payments': [200, { id: 'pay_1', invoiceUrl: 'https://i', bankSlipUrl: null }],
  });
  try {
    const out = await createAsaasProvider(config).emit(input());
    assert.equal(out.externalId, 'pay_1');
    assert.equal(out.invoiceUrl, 'https://i');
    assert.equal(out.newProviderCustomerId, 'cus_1');
    assert.deepEqual(f.calls.map((c) => c.method), ['POST', 'POST']);
    const pay = f.calls[1].body as Record<string, unknown>;
    assert.equal(pay.customer, 'cus_1');
    assert.equal(pay.externalReference, 'inv1');
    assert.equal(pay.description, 'Cobrança COB-1');
    assert.equal(pay.dueDate, '2999-01-05');
  } finally { f.restore(); }
});

test('cliente que já existe não é criado de novo', async () => {
  const f = fakeAsaas({ 'POST /payments': [200, { id: 'pay_2' }] });
  try {
    const out = await createAsaasProvider(config).emit(input({}, { providerCustomerId: 'cus_9' }));
    assert.equal(out.newProviderCustomerId, null);
    assert.equal(f.calls.length, 1);
    assert.equal((f.calls[0].body as { customer: string }).customer, 'cus_9');
  } finally { f.restore(); }
});

test('reemissão cancela a cobrança anterior ANTES de criar a nova', async () => {
  const f = fakeAsaas({ 'DELETE /payments/old': [200, { deleted: true }], 'POST /payments': [200, { id: 'pay_3' }] });
  try {
    await createAsaasProvider(config).emit(input({ replaceExternalId: 'old' }, { providerCustomerId: 'cus_1' }));
    assert.deepEqual(f.calls.map((c) => c.method), ['DELETE', 'POST']);
  } finally { f.restore(); }
});

test('cobrança anterior que já não existe (404) não impede a reemissão', async () => {
  const f = fakeAsaas({ 'DELETE /payments/old': [404, { errors: [{ description: 'não encontrado' }] }], 'POST /payments': [200, { id: 'pay_4' }] });
  try {
    const out = await createAsaasProvider(config).emit(input({ replaceExternalId: 'old' }, { providerCustomerId: 'cus_1' }));
    assert.equal(out.externalId, 'pay_4');
  } finally { f.restore(); }
});

test('falha ao cancelar a anterior (não-404) para tudo: nenhuma cobrança nova é criada', async () => {
  const f = fakeAsaas({ 'DELETE /payments/old': [500, { errors: [] }], 'POST /payments': [200, { id: 'nao-deve-criar' }] });
  try {
    await assert.rejects(
      createAsaasProvider(config).emit(input({ replaceExternalId: 'old' }, { providerCustomerId: 'cus_1' })),
      (e: unknown) => e instanceof BillingProviderError && e.status === 502 && /cancelar a cobrança anterior/.test(e.message),
    );
    assert.equal(f.calls.some((c) => c.method === 'POST'), false);
  } finally { f.restore(); }
});

test('falha ao criar o cliente não cancela a cobrança anterior (ordem preservada)', async () => {
  const f = fakeAsaas({ 'POST /customers': [400, { errors: [{ code: 'invalid_cpfCnpj', description: 'CPF inválido.' }] }], 'DELETE /payments/old': [200, {}] });
  try {
    await assert.rejects(
      createAsaasProvider(config).emit(input({ replaceExternalId: 'old' })),
      (e: unknown) => e instanceof BillingProviderError && e.code === 'invalid_cpfCnpj' && /CPF inválido/.test(e.message),
    );
    assert.equal(f.calls.some((c) => c.method === 'DELETE'), false);
  } finally { f.restore(); }
});

test('Pix não liberado na conta: o código do Asaas chega à orquestração', async () => {
  const f = fakeAsaas({ 'POST /payments': [400, { errors: [{ code: 'invalid_billingType', description: 'O Pix não está disponível' }] }] });
  try {
    await assert.rejects(
      createAsaasProvider(config).emit(input({}, { providerCustomerId: 'cus_1' })),
      (e: unknown) => e instanceof BillingProviderError && e.code === 'invalid_billingType',
    );
  } finally { f.restore(); }
});

test('QR do Pix: devolve o copia e cola; falha da rede vira null', async () => {
  const ok = fakeAsaas({ 'GET /payments/pay_1/pixQrCode': [200, { payload: '000201...', encodedImage: 'iVBOR' }] });
  try {
    assert.deepEqual(await createAsaasProvider(config).fetchPixQr('pay_1'), { payload: '000201...', encodedImage: 'iVBOR' });
  } finally { ok.restore(); }
  const bad = fakeAsaas({});
  try {
    assert.equal(await createAsaasProvider(config).fetchPixQr('pay_1'), null);
  } finally { bad.restore(); }
});

test('vencimento no passado vai com a data de hoje (o Asaas recusa data passada)', () => {
  const now = new Date('2026-11-16T15:00:00Z');
  assert.equal(asaasDueDate(new Date('2026-01-05T00:00:00Z'), now), '2026-11-16');
  assert.equal(asaasDueDate(new Date('2026-12-05T00:00:00Z'), now), '2026-12-05');
});
