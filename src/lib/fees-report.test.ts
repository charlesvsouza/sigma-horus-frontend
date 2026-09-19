import test from 'node:test';
import assert from 'node:assert/strict';
import { asaasIdFromNote, buildFeeReport, type FeeRow } from './fees-report.ts';

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const row = (over: Partial<FeeRow> & { id: string }): FeeRow => ({
  date: d('2026-09-10'), invoiceNumber: 'COB-1', memberName: 'Irmão', method: 'PIX', gross: 110, fee: 1.99, passedOn: 0, ...over,
});

test('totais: bruto, tarifa real, líquido e % — tudo em centavos', () => {
  const r = buildFeeReport([
    row({ id: '1' }),
    row({ id: '2', gross: 110, fee: 1.99, method: 'BOLETO' }),
    row({ id: '3', gross: 30.3, fee: 0.99, date: d('2026-10-02') }),
  ]);
  assert.equal(r.count, 3);
  assert.equal(r.gross, 250.3);
  assert.equal(r.fee, 4.97);
  assert.equal(r.net, 245.33);
  assert.equal(r.absorbed, 4.97); // política atual: a loja absorve tudo
  assert.equal(r.passedOn, 0);
  assert.equal(r.averageFee, 1.66);
  assert.equal(r.feePercent, 1.99);
});

test('agrupa por método e por mês', () => {
  const r = buildFeeReport([
    row({ id: '1' }),
    row({ id: '2', method: 'BOLETO' }),
    row({ id: '3', date: d('2026-10-02') }),
  ]);
  assert.deepEqual(r.byMethod.map((b) => [b.key, b.count]), [['BOLETO', 1], ['PIX', 2]]);
  assert.deepEqual(r.byMonth.map((b) => [b.key, b.count, b.fee]), [['2026-09', 2, 3.98], ['2026-10', 1, 1.99]]);
});

test('recebimento sem líquido informado é contado à parte, sem inventar tarifa', () => {
  const r = buildFeeReport([row({ id: '1' }), row({ id: '2', fee: null })]);
  assert.equal(r.unknownFeeCount, 1);
  assert.equal(r.fee, 1.99);
  assert.equal(r.averageFee, 1.99);
});

test('cartão aparece como fora da política', () => {
  const r = buildFeeReport([row({ id: '1' }), row({ id: '2', method: 'CREDIT_CARD', fee: 3.29 })]);
  assert.deepEqual(r.outOfPolicy.map((x) => x.id), ['2']);
});

test('quando houver repasse ao membro, a absorvida é a diferença', () => {
  const r = buildFeeReport([row({ id: '1', fee: 1.99, passedOn: 1.99 }), row({ id: '2', fee: 1.99, passedOn: 0 })]);
  assert.equal(r.absorbed, 1.99);
  assert.equal(r.passedOn, 1.99);
});

test('vazio', () => {
  const r = buildFeeReport([]);
  assert.equal(r.count, 0);
  assert.equal(r.feePercent, 0);
  assert.equal(r.averageFee, 0);
});

test('id do Asaas extraído da nota da baixa', () => {
  assert.equal(asaasIdFromNote('Baixa automática Asaas (pay_abc123)'), 'pay_abc123');
  assert.equal(asaasIdFromNote('Tarifa Asaas (pay_abc123)'), 'pay_abc123');
  assert.equal(asaasIdFromNote('sem parênteses'), null);
  assert.equal(asaasIdFromNote(null), null);
});
