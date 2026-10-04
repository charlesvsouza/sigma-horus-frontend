import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreementChargeMessage, agreementTxid, suggestAgreementMatches, balanceCharge, canHandleAgreementCharge, chargeableParcels, parseChargeTarget, pickCharge, sendMarksByTarget } from './agreement-charge.ts';

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const block = (paid: number, remaining = 300 - paid) => ({ id: 'blk1', kind: 'regularization', total: 300, installments: 3, firstDueDate: D('2026-10-10'), paid, remaining });

test('quem gera/envia a cobrança do acordo', () => {
  for (const r of ['admin', 'Venerable', 'treasurer']) assert.equal(canHandleAgreementCharge(r), true);
  for (const r of ['secretary', 'member', '', null, undefined]) assert.equal(canHandleAgreementCharge(r), false);
});

test('alvo: número da parcela ou saldo', () => {
  assert.equal(parseChargeTarget('2'), 2);
  assert.equal(parseChargeTarget(3), 3);
  assert.equal(parseChargeTarget('balance'), 'balance');
  for (const bad of ['0', '-1', 'x', '1.5', null, undefined]) assert.equal(parseChargeTarget(bad), null);
});

test('parcelas cobráveis: nada pago → 3 de 100; a vencida sai marcada', () => {
  const list = chargeableParcels(block(0), D('2026-11-15'));
  assert.deepEqual(list.map((c) => [c.number, c.amount, c.late]), [[1, 100, true], [2, 100, true], [3, 100, false]]);
});

test('parcela coberta some; pagar a menos deixa só a diferença daquela parcela', () => {
  assert.deepEqual(chargeableParcels(block(100), D('2026-10-01')).map((c) => [c.number, c.amount]), [[2, 100], [3, 100]]);
  // pagou 60 de 100: a parcela 1 ainda cobra 40; as outras seguem em 100 (a soma é o saldo, 240)
  assert.deepEqual(chargeableParcels(block(60), D('2026-10-01')).map((c) => [c.number, c.amount]), [[1, 40], [2, 100], [3, 100]]);
  // pagou 130: a 1 está coberta e a 2 cobra 70
  assert.deepEqual(chargeableParcels(block(130), D('2026-10-01')).map((c) => [c.number, c.amount]), [[2, 70], [3, 100]]);
  assert.deepEqual(chargeableParcels(block(300, 0), D('2026-10-01')), []);
});

test('saldo todo: um Pix pelo que falta', () => {
  assert.equal(balanceCharge(block(100), D('2026-10-01'))?.amount, 200);
  assert.equal(balanceCharge(block(300, 0), D('2026-10-01')), null);
  assert.equal(pickCharge(block(0), 'balance', D('2026-10-01'))?.amount, 300);
  assert.equal(pickCharge(block(100), 1, D('2026-10-01')), null); // já coberta
});

test('identificador do Pix: estável, alfanumérico, até 25 e muda com o valor', () => {
  const a = agreementTxid('blk1', 2, 100);
  assert.equal(a, agreementTxid('blk1', 2, 100));
  assert.match(a, /^ACD[0-9A-F]{18}$/);
  assert.ok(a.length <= 25);
  assert.notEqual(a, agreementTxid('blk1', 2, 140));
  assert.notEqual(a, agreementTxid('blk1', 3, 100));
  assert.notEqual(a, agreementTxid('blk2', 2, 100));
});

test('mensagem: parcela a vencer, vencida e saldo, com o Pix numa linha própria', () => {
  const [p1] = chargeableParcels(block(0), D('2026-10-01'));
  const ok = agreementChargeMessage({ memberName: 'Fulano', kind: 'settlement', charge: p1, installments: 3, pixCopyPaste: '000201PIX' });
  assert.match(ok, /parcela 1\/3 do acordo de quitação de dívidas/);
  assert.match(ok, /com vencimento em 10\/10\/2026/);
  assert.ok(ok.split('\n').includes('000201PIX'));
  const [late] = chargeableParcels(block(0), D('2026-11-01'));
  assert.match(agreementChargeMessage({ memberName: 'Fulano', kind: 'regularization', charge: late, installments: 3 }), /vencida em 10\/10\/2026/);
  const bal = balanceCharge(block(0), D('2026-10-01'))!;
  assert.match(agreementChargeMessage({ memberName: 'Fulano', kind: 'regularization', charge: bal, installments: 3 }), /quitar de uma só vez o saldo/);
});

test('marcas de envio: confirmado, aberto sem confirmar e e-mail, por alvo', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 5, h));
  const marks = sendMarksByTarget([
    { ref: 'acordo:blk1:1', channel: 'whatsapp-manual', status: 'handed-off', createdAt: at(10) },
    { ref: 'acordo:blk1:1', channel: 'whatsapp-manual', status: 'sent', createdAt: at(11) },
    { ref: 'acordo:blk1:2', channel: 'whatsapp-manual', status: 'handed-off', createdAt: at(9) },
    { ref: 'acordo:blk1:balance', channel: 'email', status: 'sent', createdAt: at(8) },
    { ref: 'acordo:outro:1', channel: 'email', status: 'sent', createdAt: at(8) },
    { ref: null, channel: 'email', status: 'sent', createdAt: at(8) },
  ], 'blk1');
  assert.equal(marks.get('1')?.sentAt?.getTime(), at(11).getTime());
  assert.equal(marks.get('1')?.openedAt, null);
  assert.equal(marks.get('2')?.openedAt?.getTime(), at(9).getTime());
  assert.equal(marks.get('balance')?.emailedAt?.getTime(), at(8).getTime());
  assert.equal(marks.size, 3);
});

test('extrato: valor de uma parcela = exato; nome sem valor só entra se couber no saldo; saldo menor que o crédito nunca', () => {
  const blocks = [
    { memberId: 'a', memberName: 'Fulano de Tal', block: { ...block(0), id: 'b1' } },
    { memberId: 'b', memberName: 'Beltrano Silva', block: { ...block(0), id: 'b2', total: 90, remaining: 90, installments: 3 } },
  ];
  const today = D('2026-10-01');
  // 100 = parcela do Fulano (exato); o Beltrano tem saldo 90 < 100 e some
  const r1 = suggestAgreementMatches({ amount: 100, description: 'PIX RECEBIDO FULANO DE TAL' }, blocks, today);
  assert.deepEqual(r1.map((x) => [x.memberId, x.label, x.amountMatch, x.nameMatch]), [['a', 'Parcela 1/3', 'exact', 'strong']]);
  // 300 = saldo todo do Fulano
  assert.equal(suggestAgreementMatches({ amount: 300, description: 'pix' }, blocks, today)[0]?.label, 'Quitação do saldo do acordo');
  // 150 com o nome: parcial; sem nome e sem valor exato: nada
  assert.equal(suggestAgreementMatches({ amount: 150, description: 'Fulano de Tal' }, blocks, today)[0]?.label, 'Pagamento parcial do acordo');
  assert.deepEqual(suggestAgreementMatches({ amount: 150, description: 'pix qualquer' }, blocks, today), []);
});
