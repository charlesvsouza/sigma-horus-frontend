import assert from 'node:assert/strict';
import test from 'node:test';
import { checkManualSettlement, settlementLabel, settlementTypeOf } from './settlement-type';

test('tipo gravado vale; sem tipo, deduz da forma e da observação', () => {
  assert.equal(settlementTypeOf({ settlementType: 'cash', method: 'pix' }), 'cash');
  assert.equal(settlementTypeOf({ method: 'asaas', note: 'Baixa automática Asaas (pay_1)' }), 'asaas_auto');
  assert.equal(settlementTypeOf({ method: 'asaas-cash' }), 'cash');
  assert.equal(settlementTypeOf({ method: 'import' }), 'import');
  assert.equal(settlementTypeOf({ method: 'pix', note: 'Pix conferido pelo comprovante (nº de controle E123)' }), 'receipt_check');
  assert.equal(settlementTypeOf({ method: 'pix', note: 'x', bankMatched: true }), 'bank_statement');
  assert.equal(settlementTypeOf({ method: 'manual' }), 'manual_other');
});

test('doação, custeio, tarifa e estorno não são baixa', () => {
  for (const method of ['donation', 'fund', 'asaas-fee', 'asaas-refund']) assert.equal(settlementTypeOf({ method }), null);
  assert.equal(settlementLabel({ method: 'donation' }), '—');
  assert.equal(settlementLabel({ method: 'asaas' }), 'Automática Asaas');
});

test('baixa manual: tipo obrigatório e só as opções escolhíveis', () => {
  assert.equal(checkManualSettlement(undefined).ok, false);
  assert.equal(checkManualSettlement('').ok, false);
  assert.equal(checkManualSettlement('asaas_auto').ok, false);
  assert.equal(checkManualSettlement('import').ok, false);
  assert.equal(checkManualSettlement('lixo').ok, false);
  assert.deepEqual(checkManualSettlement('receipt_check'), { ok: true, value: 'receipt_check' });
});
