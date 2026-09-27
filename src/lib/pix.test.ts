import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPixPayload, crc16, normalizePixKey } from './pix.ts';

// Exemplo do Manual de Padrões para Iniciação do Pix (BACEN).
const BACEN_EXAMPLE =
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D';

test('CRC16 bate com o exemplo oficial do BACEN', () => {
  assert.equal(crc16(BACEN_EXAMPLE.slice(0, -4)), '1D3D');
});

test('payload sem valor reproduz o exemplo do BACEN', () => {
  assert.equal(
    buildPixPayload({ key: '123e4567-e12b-12d1-a456-426655440000', name: 'Fulano de Tal', city: 'BRASILIA' }),
    BACEN_EXAMPLE,
  );
});

test('payload com valor, txid e CRC coerente', () => {
  const p = buildPixPayload({ key: 'tesouraria@loja.org', name: 'Loja Teste', city: 'Rio', amount: 110, txid: 'cmabc-123' });
  assert.match(p, /5406110\.00/);
  assert.match(p, /62120508cmabc123/);
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
});

test('nome e cidade sem acento e truncados em 25/15', () => {
  const p = buildPixPayload({
    key: 'a@b.co',
    name: 'Augusta e Respeitável Loja Simbólica Horus',
    city: 'São João de Meriti',
  });
  assert.match(p, /5925Augusta e Respeitavel Loj/);
  assert.match(p, /6015Sao Joao de Mer/);
  assert.match(p, /62070503\*\*\*/);
});

test('chave: formatos digitados pela Tesouraria', () => {
  assert.equal(normalizePixKey(' Tesouraria@Loja.ORG '), 'tesouraria@loja.org');
  assert.equal(normalizePixKey('123.456.789-09'), '12345678909');
  assert.equal(normalizePixKey('12.345.678/0001-95'), '12345678000195');
  assert.equal(normalizePixKey('(21) 99999-0000'), '+5521999990000');
  assert.equal(normalizePixKey('21999990000'), '+5521999990000'); // não é CPF válido
  assert.equal(normalizePixKey('+55 21 99999-0000'), '+5521999990000');
  assert.equal(normalizePixKey('123E4567-E12B-12D1-A456-426655440000'), '123e4567-e12b-12d1-a456-426655440000');
});
