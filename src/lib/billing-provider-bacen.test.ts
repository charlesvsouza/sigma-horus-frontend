import test from 'node:test';
import assert from 'node:assert/strict';
import { createBacenPixProvider, type BacenTransport } from './billing-provider-bacen.ts';
import { BillingProviderError, type ProviderEmitInput } from './billing-provider.ts';
import { bancoPorId, type BankSpec } from './bank-catalog.ts';
import { sanitizeTxid } from './bacen-pix.ts';

process.env.ENCRYPTION_KEY ??= 'chave-de-teste-com-tamanho-suficiente';

const credenciais = {
  clientId: 'cid', clientSecret: 'csecret',
  certificatePem: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
  privateKeyPem: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----',
};

const entrada: ProviderEmitInput = {
  invoice: { id: 'inv_XYZ', number: 'COB-202611-0002', description: 'Mensalidade 11/2026', dueDate: new Date('2026-11-25T12:00:00Z') },
  member: { id: 'm1', name: 'Ir. Teste', email: null, phone: null, cpf: '12345678909', providerCustomerId: null },
  value: 150, method: 'PIX', replaceExternalId: null,
};

/** Banco fictício com Pix padrão Bacen: só a declaração muda, o código é o mesmo. */
const bancoFicticio: BankSpec = {
  id: 'bancoteste',
  label: 'Banco Teste',
  auth: 'oauth2-mtls',
  status: 'ready',
  pixPadrao: 'bacen',
  boleto: 'indefinido',
  endpoints: {
    production: {
      tokenBase: 'https://sts.bancoteste.com.br',
      apiBase: 'https://api.bancoteste.com.br',
      tokenPath: '/oauth/token',
      pixCob: '/pix/v2/cob',
      pixCobQr: '/pix/v2/cob/{txid}/qrcode',
      boleto: null,
      apiKeyHeader: null,
    },
    sandbox: {
      tokenBase: 'https://sts.sandbox.bancoteste.com.br',
      apiBase: 'https://api.sandbox.bancoteste.com.br',
      tokenPath: '/oauth/token',
      pixCob: '/pix/v2/cob',
      pixCobQr: '/pix/v2/cob/{txid}/qrcode',
      boleto: null,
      apiKeyHeader: null,
    },
  },
};

function fakeTransport(routes: Record<string, [number, unknown]>) {
  const chamadas: { method: string; url: string; body?: string; comCertificado: boolean }[] = [];
  const transport: BacenTransport = async (req) => {
    chamadas.push({ method: req.method, url: req.url, body: req.body, comCertificado: Boolean(req.certificatePem) });
    const chave = `${req.method} ${new URL(req.url).pathname}`;
    const r = routes[chave] ?? [404, { detail: 'rota não mapeada' }];
    return { status: r[0], body: r[1] };
  };
  return { transport, chamadas };
}

test('banco novo do catálogo emite Pix sem código por banco', async () => {
  const txid = sanitizeTxid(entrada.invoice.id);
  const { transport, chamadas } = fakeTransport({
    'POST /oauth/token': [200, { access_token: 'tok-1' }],
    [`PUT /pix/v2/cob/${txid}`]: [201, { txid, status: 'ATIVA' }],
  });
  const provider = createBacenPixProvider(bancoFicticio, { env: 'sandbox', credentials: credenciais, pixKey: 'loja@exemplo.com' }, transport);

  const saida = await provider.emit(entrada);
  assert.equal(provider.id, 'bancoteste');
  assert.equal(provider.label, 'Banco Teste');
  assert.equal(saida.externalId, txid);
  assert.equal(chamadas[0].url, 'https://sts.sandbox.bancoteste.com.br/oauth/token');
  assert.equal(chamadas[1].url, `https://api.sandbox.bancoteste.com.br/pix/v2/cob/${txid}`);
  assert.ok(chamadas.every((c) => c.comCertificado), 'todas as chamadas levam o certificado (TLS mútuo)');
});

test('banco sem adaptador próprio recusa boleto com mensagem clara', async () => {
  const provider = createBacenPixProvider(bancoFicticio, { env: 'sandbox', credentials: credenciais, pixKey: 'loja@exemplo.com' }, fakeTransport({}).transport);
  await assert.rejects(() => provider.emit({ ...entrada, method: 'BOLETO' }), (err: unknown) => {
    const e = err as BillingProviderError;
    assert.ok(e instanceof BillingProviderError);
    assert.equal(e.status, 409);
    assert.match(e.message, /ainda não emite boleto/i);
    return true;
  });
});

test('autenticação por chave de API dispensa certificado', async () => {
  const porChave: BankSpec = { ...bancoFicticio, auth: 'api-key', endpoints: { production: { ...bancoFicticio.endpoints!.production, tokenPath: '' } } };
  const txid = sanitizeTxid(entrada.invoice.id);
  const { transport, chamadas } = fakeTransport({
    [`PUT /pix/v2/cob/${txid}`]: [201, { txid, status: 'ATIVA' }],
  });
  const provider = createBacenPixProvider(porChave, { env: 'production', credentials: null, pixKey: 'loja@exemplo.com', apiKey: 'chave-123' }, transport);
  const saida = await provider.emit(entrada);
  assert.equal(saida.externalId, txid);
  assert.equal(chamadas.length, 1, 'não pede token: vai direto na API');
  assert.equal(chamadas[0].comCertificado, false);
});

test('sem credencial o provedor recusa antes de chamar o banco', async () => {
  const { transport, chamadas } = fakeTransport({});
  const provider = createBacenPixProvider(bancoFicticio, { env: 'sandbox', credentials: null, pixKey: 'loja@exemplo.com' }, transport);
  await assert.rejects(() => provider.emit(entrada), (err: unknown) => {
    const e = err as BillingProviderError;
    assert.equal(e.status, 409);
    assert.match(e.message, /não tem credenciais/i);
    return true;
  });
  assert.equal(chamadas.length, 0);
});

test('o catálogo real continua dirigindo o provedor do Itaú pelo adaptador próprio', () => {
  assert.equal(bancoPorId('itau')?.status, 'ready');
  assert.equal(bancoPorId('bancoteste'), undefined, 'banco de teste não entra no catálogo real');
});
