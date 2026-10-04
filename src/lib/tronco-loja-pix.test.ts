import test from 'node:test';
import assert from 'node:assert/strict';
import { donationTxid, identifierInText, sessionTxid } from './tronco-loja-pix.ts';
import { buildPixPayload } from './pix.ts';

test('identificador da sessão: estável, curto, só letras e números e distinto por sessão e origem', () => {
  const a = sessionTxid('sessao-1', 'members');
  assert.equal(a, sessionTxid('sessao-1', 'members'));
  assert.match(a, /^TRM[A-HJ-NP-Z2-9]{8}$/);
  assert.match(sessionTxid('sessao-1', 'visitors'), /^TRV[A-HJ-NP-Z2-9]{8}$/);
  assert.notEqual(sessionTxid('sessao-1', 'members'), sessionTxid('sessao-1', 'visitors')); // origens distintas (M/V)
  assert.notEqual(a, sessionTxid('sessao-2', 'members'));
  assert.ok(a.length <= 25);
});

test('txid da doação do portal vem do DNA', () => {
  assert.equal(donationTxid('TR-AB2C-D3EF'), 'TRPAB2CD3EF');
  assert.equal(donationTxid('AC-AB2C-D3EF'), null);
  assert.equal(donationTxid('TR-ab2c-d3ef'), null);
});

test('o identificador entra no BR Code da chave da loja (txid) e é achado na descrição do extrato', () => {
  const txid = sessionTxid('sessao-1', 'members');
  const payload = buildPixPayload({ key: 'loja@exemplo.com.br', name: 'Loja Teste', city: 'Rio de Janeiro', txid });
  assert.ok(payload.includes(txid), 'o txid vai no campo de referência do Pix');
  assert.ok(payload.startsWith('000201'));
  assert.ok(identifierInText(`PIX RECEBIDO FULANO ${txid} 20/10`, txid));
  assert.ok(identifierInText(`pix recebido ${txid.slice(0, 5)}-${txid.slice(5)}`, txid), 'ignora hífen e caixa');
  assert.ok(!identifierInText('PIX RECEBIDO FULANO TRMOUTRAXXXX', txid));
  assert.ok(!identifierInText('PIX', 'TR'), 'identificador curto demais não vale');
});
