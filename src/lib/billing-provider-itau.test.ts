import test from 'node:test';
import assert from 'node:assert/strict';
import { createItauProvider, sanitizeTxid, itauDate, onlyDigits, buildBoletoBody, ITAU_ENDPOINTS, type ItauTransport } from './billing-provider-itau.ts';
import { BillingProviderError, type ProviderEmitInput } from './billing-provider.ts';

process.env.ENCRYPTION_KEY ??= 'chave-de-teste-com-tamanho-suficiente';

const credenciais = {
  clientId: 'client-id-123',
  clientSecret: 'client-secret-456',
  certificatePem: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
  privateKeyPem: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----',
};

const entrada: ProviderEmitInput = {
  invoice: { id: 'inv_01ABCdef', number: 'COB-202611-0001', description: 'Mensalidade 11/2026', dueDate: new Date('2026-11-20T02:00:00Z') },
  member: { id: 'm1', name: 'Ir. Teste da Silva', email: 'teste@exemplo.com', phone: '(21) 99999-0000', cpf: '123.456.789-09', providerCustomerId: null },
  value: 220,
  method: 'PIX',
  replaceExternalId: null,
};

/** Transporte falso: devolve respostas por "MÉTODO caminho" e guarda as chamadas. */
function fakeTransport(routes: Record<string, [number, unknown]>) {
  const chamadas: { method: string; url: string; body?: string; headers: Record<string, string> }[] = [];
  const transport: ItauTransport = async (req) => {
    chamadas.push({ method: req.method, url: req.url, body: req.body, headers: req.headers });
    const caminho = new URL(req.url).pathname;
    const chave = `${req.method} ${caminho}`;
    const resposta = routes[chave] ?? [404, { detail: 'rota não mapeada no teste' }];
    return { status: resposta[0], body: resposta[1] };
  };
  return { transport, chamadas };
}

test('txid do Pix respeita o tamanho do Bacen', () => {
  assert.equal(sanitizeTxid('inv_01ABCdef').length, 26);
  assert.equal(sanitizeTxid('inv_01ABCdef'), 'inv01abcdef'.padEnd(26, '0'));
  assert.equal(sanitizeTxid('a'.repeat(60)).length, 35);
});

test('data do Itaú é o dia de Brasília', () => {
  assert.equal(itauDate(new Date('2026-11-20T02:00:00Z')), '2026-11-19');
  assert.equal(itauDate(new Date('2026-11-20T15:00:00Z')), '2026-11-20');
});

test('documento vai só com dígitos', () => {
  assert.equal(onlyDigits('123.456.789-09'), '12345678909');
});

test('boleto: valor, vencimento e pagador pessoa física', () => {
  const body = buildBoletoBody({
    value: 220.5, dueDate: new Date('2026-12-05T12:00:00Z'), invoiceNumber: 'COB-202612-0007',
    description: 'Mensalidade 12/2026', member: { name: 'Ir. Teste da Silva', cpf: '123.456.789-09', email: 't@e.com', phone: '21999990000' },
  }) as any;
  assert.equal(body.valor.valor_total, 220.5);
  assert.equal(body.vencimento.data_vencimento, '2026-12-05');
  assert.equal(body.pagador.tipo_pessoa.codigo_tipo_pessoa, 'F');
  assert.equal(body.pagador.pessoa.tipo_pessoa_cpf.numero_cpf, '12345678909');
  assert.equal(body.dado_boleto.descricao_instrumento_cobranca, 'Mensalidade 12/2026');
});

test('sem credenciais a emissão falha com 409 e mensagem de configuração', async () => {
  const provider = createItauProvider({ env: 'sandbox', credentials: null, pixKey: 'chave@pix' }, fakeTransport({}).transport);
  assert.equal(provider.id, 'itau');
  assert.equal(provider.label, 'Itaú');
  await assert.rejects(
    () => provider.emit(entrada),
    (err: unknown) => {
      const e = err as BillingProviderError;
      assert.ok(e instanceof BillingProviderError);
      assert.equal(e.status, 409);
      assert.match(e.message, /credenciais/i);
      return true;
    },
  );
});

test('sem chave Pix a emissão Pix avisa antes de chamar o banco', async () => {
  const { transport, chamadas } = fakeTransport({});
  const provider = createItauProvider({ env: 'sandbox', credentials: credenciais, pixKey: null }, transport);
  await assert.rejects(() => provider.emit(entrada), (err: unknown) => {
    const e = err as BillingProviderError;
    assert.ok(e instanceof BillingProviderError);
    assert.equal(e.status, 409);
    assert.match(e.message, /chave Pix/i);
    return true;
  });
  assert.equal(chamadas.length, 0);
});

test('Pix: pega token, cria a cobrança e devolve o txid', async () => {
  const txid = sanitizeTxid(entrada.invoice.id);
  const { transport, chamadas } = fakeTransport({
    'POST /api/oauth/token': [200, { access_token: 'tok-1' }],
    [`PUT /pix/v2/cob/${txid}`]: [201, { txid, status: 'ATIVA' }],
  });
  const provider = createItauProvider({ env: 'sandbox', credentials: credenciais, pixKey: 'loja@exemplo.com' }, transport);
  const saida = await provider.emit(entrada);

  assert.equal(saida.externalId, txid);
  assert.equal(chamadas.length, 2);
  assert.equal(chamadas[0].method, 'POST');
  assert.match(chamadas[0].body ?? '', /grant_type=client_credentials/);
  assert.equal(chamadas[1].headers.Authorization, 'Bearer tok-1');
  const corpo = JSON.parse(chamadas[1].body ?? '{}');
  assert.equal(corpo.valor.original, '220.00');
  assert.equal(corpo.chave, 'loja@exemplo.com');
});

test('Pix: QR vem do banco quando existe', async () => {
  const { transport } = fakeTransport({
    'POST /api/oauth/token': [200, { access_token: 'tok-2' }],
    'GET /pix/v2/cob/abc/qrcode': [200, { qrcode: '00020126...', imagemQrcode: 'data:image/png;base64,QUJD' }],
  });
  const provider = createItauProvider({ env: 'sandbox', credentials: credenciais, pixKey: 'loja@exemplo.com' }, transport);
  const qr = await provider.fetchPixQr('abc');
  assert.deepEqual(qr, { payload: '00020126...', encodedImage: 'QUJD' });
});

test('boleto: devolve linha digitável e link', async () => {
  const { transport } = fakeTransport({
    'POST /api/oauth/token': [200, { access_token: 'tok-3' }],
    'POST /cobranca/v2/boletos': [200, { dado_boleto: { numero_linha_digitavel: '34191.79001 01043.510047', url_boleto: 'https://itau/boleto/1' } }],
  });
  const provider = createItauProvider({ env: 'production', credentials: credenciais }, transport);
  const saida = await provider.emit({ ...entrada, method: 'BOLETO' });
  assert.equal(saida.externalId, '34191.79001 01043.510047');
  assert.equal(saida.bankSlipUrl, 'https://itau/boleto/1');
  assert.equal(saida.invoiceUrl, 'https://itau/boleto/1');
});

test('token recusado vira erro de credencial, não erro cru', async () => {
  const { transport } = fakeTransport({
    'POST /api/oauth/token': [401, { error: 'invalid_client' }],
  });
  const provider = createItauProvider({ env: 'production', credentials: credenciais, pixKey: 'loja@exemplo.com' }, transport);
  await assert.rejects(() => provider.emit(entrada), (err: unknown) => {
    const e = err as BillingProviderError;
    assert.ok(e instanceof BillingProviderError);
    assert.equal(e.status, 502);
    assert.match(e.message, /recusou as credenciais/i);
    return true;
  });
});

test('endpoints de produção e sandbox não se misturam', () => {
  assert.match(ITAU_ENDPOINTS.production.tokenBase, /sts\.itau\.com\.br/);
  assert.match(ITAU_ENDPOINTS.sandbox.tokenBase, /sandbox/);
  assert.notEqual(ITAU_ENDPOINTS.production.apiBase, ITAU_ENDPOINTS.sandbox.apiBase);
});
