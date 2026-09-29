import test from 'node:test';
import assert from 'node:assert/strict';
import { amountsInText, checkReceipt, paidAtInText, receiptTxids } from './receipt-check.ts';

// Texto real extraído do comprovante do App Bradesco (Pix para a amm139, 2026-09-27).
const BRADESCO = `Comprovante de pagamento Pix
27/09/2026 - 23:45:22
Valor: R$ 220,00
Dados de quem recebeu
Nome: LOJA MACONICA ANTONIO MONTEIRO MARTINS N
CPF/CNPJ: 07.470.382/0001-66
Instituição: BCO SANTANDER (BRASIL) S.A.
Dados do pagamento
Tipo: Pix
Valor: R$ 220,00
Identificador: cmukms8u8000804idnyx3vppj
Data do débito: 27/09/2026 - 23:45:17
Número de controle: E60746948202609280244A1804dFKhzY
Dados de quem pagou
Nome: CHARLES VASCONCELOS DE SOUZA
CPF: ***.363.917-**`;

const expected = { txids: ['cmukms8u8000804idnyx3vppj'], amount: 220, lodgeCnpj: '07.470.382/0001-66', lodgePixKey: null };

test('comprovante real do Bradesco: conferido nos quatro pontos', () => {
  const r = checkReceipt(BRADESCO, expected);
  assert.equal(r.status, 'conferido');
  assert.equal(r.txid, true);
  assert.equal(r.amount, true);
  assert.equal(r.payee, true);
  assert.equal(r.e2e, 'E60746948202609280244A1804dFKhzY');
  assert.equal(r.paidAt, '2026-09-28T02:45:22.000Z'); // 23:45:22 em Brasília
});

test('divergências: identificador de outra conta, valor diferente, outro recebedor, sem número de controle', () => {
  assert.equal(checkReceipt(BRADESCO, { ...expected, txids: ['cmoutraconta000000000000'] }).txid, false);
  const valor = checkReceipt(BRADESCO, { ...expected, amount: 110 });
  assert.equal(valor.amount, false);
  assert.equal(valor.status, 'divergente');
  assert.equal(checkReceipt(BRADESCO, { ...expected, lodgeCnpj: '11.222.333/0001-81' }).payee, false);
  assert.equal(checkReceipt(BRADESCO.replace(/Número de controle.*\n/, ''), expected).status, 'divergente');
});

test('recebedor pela chave Pix quando o comprovante não traz o CNPJ', () => {
  const semCnpj = BRADESCO.replace('CPF/CNPJ: 07.470.382/0001-66', 'Chave: tesouraria@loja.org');
  assert.equal(checkReceipt(semCnpj, { ...expected, lodgeCnpj: null, lodgePixKey: 'tesouraria@loja.org' }).payee, true);
});

test('PDF sem texto (imagem escaneada) é ilegível', () => {
  assert.equal(checkReceipt('   ', expected).status, 'ilegivel');
});

test('valores e datas em formatos comuns', () => {
  assert.deepEqual(amountsInText('Total R$ 1.234,56 · tarifa R$0,00'), [1234.56, 0]);
  assert.equal(paidAtInText('Pago em 05/10/2026 às 08:07'), '2026-10-05T11:07:00.000Z');
  assert.equal(paidAtInText('Data: 05/10/2026'), '2026-10-05T15:00:00.000Z');
});

test('Pix enviado pelo WhatsApp: identificador é o nº da cobrança e também confere', () => {
  const whatsapp = BRADESCO.replace('Identificador: cmukms8u8000804idnyx3vppj', 'Identificador: COB2026090043');
  const txids = receiptTxids(['cmukms8u8000804idnyx3vppj'], ['COB-202609-0043']);
  assert.deepEqual(txids, ['cmukms8u8000804idnyx3vppj', 'COB2026090043']);
  assert.equal(checkReceipt(whatsapp, { ...expected, txids }).status, 'conferido');
  // Só com o id da conta (como era antes), o mesmo comprovante acusava divergência.
  assert.equal(checkReceipt(whatsapp, expected).txid, false);
});
