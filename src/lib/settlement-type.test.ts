import assert from 'node:assert/strict';
import test from 'node:test';
import { canRegisterPreOpening, checkManualSettlement, checkPreOpening, settlementLabel, settlementTypeOf } from './settlement-type';

const today = new Date('2026-10-27T12:00:00Z');
const okPre = { role: 'treasurer', accountType: 'RECEIVABLE', lateCharge: 0, paidAt: new Date('2026-03-10T00:00:00Z'), today, note: 'Pagou ao Tesoureiro anterior em março' };

test('pago antes da abertura: tipo escolhível, com nome claro, e só Tesouraria/gestão registram', () => {
  assert.deepEqual(checkManualSettlement('pre_opening'), { ok: true, value: 'pre_opening' });
  assert.equal(settlementLabel({ settlementType: 'pre_opening', method: 'manual' }), 'Pago antes da abertura do livro caixa');
  for (const r of ['admin', 'venerable', 'treasurer', 'Treasurer']) assert.equal(canRegisterPreOpening(r), true);
  for (const r of ['secretary', 'member', 'hospitaller', '', null, undefined]) assert.equal(canRegisterPreOpening(r), false);
});

test('pago antes da abertura: só conta a receber, sem multa, data passada e motivo escrito', () => {
  assert.equal(checkPreOpening(okPre).ok, true);
  assert.equal(checkPreOpening({ ...okPre, role: 'secretary' }).ok, false);
  assert.equal(checkPreOpening({ ...okPre, accountType: 'PAYABLE' }).ok, false);
  assert.equal(checkPreOpening({ ...okPre, lateCharge: 5 }).ok, false);
  assert.equal(checkPreOpening({ ...okPre, paidAt: new Date('2026-11-01T00:00:00Z') }).ok, false);
  assert.equal(checkPreOpening({ ...okPre, note: '  ' }).ok, false);
});

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
