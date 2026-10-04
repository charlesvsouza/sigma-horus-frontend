import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocatePayment, buildInstallments, buildPackage, canBlockMembers, checkCanBlock, installmentStates, paidSoFar, parseBlockInput,
} from './member-block';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const TODAY = d('2026-10-04');

test('canBlockMembers: só Venerável e Administrador', () => {
  assert.equal(canBlockMembers('admin'), true);
  assert.equal(canBlockMembers('Venerable'), true);
  for (const r of ['treasurer', 'secretary', 'member', 'hospitaller', '', null, undefined]) assert.equal(canBlockMembers(r), false);
});

test('checkCanBlock: exige ativo, Art. 002 ligado e mais de 60 dias', () => {
  assert.equal(checkCanBlock({ status: 'active' }, 61, true).ok, true);
  assert.equal(checkCanBlock({ status: 'active' }, 60, true).ok, false);
  assert.equal(checkCanBlock({ status: 'active' }, null, true).ok, false);
  assert.equal(checkCanBlock({ status: 'active' }, 200, false).ok, false);
  assert.equal(checkCanBlock({ status: 'blocked' }, 200, true).ok, false);
  assert.equal(checkCanBlock({ status: 'suspended' }, 200, true).ok, false);
});

test('buildPackage: taxa primeiro, depois multa/juros, depois as dívidas da mais antiga para a mais nova', () => {
  const { items, debtsTotal, total } = buildPackage(
    [
      { accountId: 'b', title: 'Mensalidade 09', amount: 100, paid: 0, dueDate: d('2026-09-10') },
      { accountId: 'a', title: 'Mensalidade 06', amount: 100, paid: 40, dueDate: d('2026-06-10') },
      { accountId: 'c', title: 'Quitada', amount: 100, paid: 100, dueDate: d('2026-07-10') },
    ],
    150,
    20,
  );
  assert.deepEqual(items.map((i) => [i.kind, i.accountId, i.openAmount]), [
    ['fee', null, 150], ['extra', null, 20], ['debt', 'a', 60], ['debt', 'b', 100],
  ]);
  assert.equal(debtsTotal, 160); // saldo (60), não o valor cheio (100)
  assert.equal(total, 330);
});

test('buildPackage: taxa 0 e sem multa → só as dívidas; inclui a vencer', () => {
  const { items, total } = buildPackage([{ accountId: 'x', title: 'Evento', amount: 50, paid: 0, dueDate: d('2027-01-10') }], 0, 0);
  assert.deepEqual(items.map((i) => i.kind), ['debt']);
  assert.equal(total, 50);
});

test('parseBlockInput: quitação ignora a taxa; regularização continua exigindo (0 vale)', () => {
  const q = parseBlockInput({ kind: 'settlement', fee: '150', installments: 2 }, TODAY);
  assert.deepEqual(q.ok && { kind: q.value.kind, fee: q.value.fee, n: q.value.installments }, { kind: 'settlement', fee: 0, n: 2 });
  assert.equal(parseBlockInput({ kind: 'settlement' }, TODAY).ok, true); // sem campo de taxa
  const r = parseBlockInput({ kind: 'regularization', fee: 0 }, TODAY);
  assert.deepEqual(r.ok && { kind: r.value.kind, fee: r.value.fee }, { kind: 'regularization', fee: 0 });
  assert.equal(parseBlockInput({ kind: 'regularization' }, TODAY).ok, false);
  assert.equal(parseBlockInput({ fee: 10 }, TODAY).ok && parseBlockInput({ fee: 10 }, TODAY).ok, true); // sem kind = regularização
});

test('parseBlockInput: taxa obrigatória (0 vale), padrão à vista, máximo 3 parcelas', () => {
  const ok = parseBlockInput({ fee: '150' }, TODAY);
  assert.deepEqual(ok.ok && { fee: ok.value.fee, extra: ok.value.extra, n: ok.value.installments, due: ok.value.firstDueDate.toISOString() }, { fee: 150, extra: 0, n: 1, due: TODAY.toISOString() });
  assert.equal(parseBlockInput({ fee: 0 }, TODAY).ok, true);
  assert.equal(parseBlockInput({}, TODAY).ok, false);
  assert.equal(parseBlockInput({ fee: '' }, TODAY).ok, false);
  assert.equal(parseBlockInput({ fee: -1 }, TODAY).ok, false);
  assert.equal(parseBlockInput({ fee: 10.123 }, TODAY).ok, false);
  assert.equal(parseBlockInput({ fee: 10, installments: 4 }, TODAY).ok, false);
  assert.equal(parseBlockInput({ fee: 10, installments: 0 }, TODAY).ok, false);
  assert.equal(parseBlockInput({ fee: 10, installments: 3 }, TODAY).ok, true);
  assert.equal(parseBlockInput({ fee: 10, extra: -5 }, TODAY).ok, false);
  assert.equal(parseBlockInput({ fee: 10, firstDueDate: '2026-10-03' }, TODAY).ok, false); // passado
  assert.equal(parseBlockInput({ fee: 10, firstDueDate: 'amanhã' }, TODAY).ok, false);
});

test('buildInstallments: centavos fecham no total e vencem de mês em mês sem estourar o fim do mês', () => {
  const one = buildInstallments(330, 1, TODAY);
  assert.deepEqual(one.map((i) => i.amount), [330]);
  const three = buildInstallments(100, 3, d('2026-11-30'));
  assert.deepEqual(three.map((i) => i.amount), [33.33, 33.33, 33.34]);
  assert.equal(three.reduce((s, i) => Math.round((s + i.amount) * 100) / 100, 0), 100);
  assert.deepEqual(three.map((i) => i.dueDate.toISOString().slice(0, 10)), ['2026-11-30', '2026-12-30', '2027-01-30']);
  const feb = buildInstallments(90, 2, d('2027-01-31'));
  assert.equal(feb[1].dueDate.toISOString().slice(0, 10), '2027-02-28');
});

test('installmentStates: o pago cobre as parcelas em ordem; vencida e descoberta = atrasada', () => {
  const inst = buildInstallments(300, 3, d('2026-09-01')); // 100 em 01/09, 01/10, 01/11
  const s0 = installmentStates(inst, 0, TODAY);
  assert.deepEqual(s0.map((i) => [i.covered, i.late]), [[false, true], [false, true], [false, false]]);
  const s1 = installmentStates(inst, 100, TODAY);
  assert.deepEqual(s1.map((i) => [i.covered, i.late]), [[true, false], [false, true], [false, false]]);
  const s2 = installmentStates(inst, 200, TODAY);
  assert.deepEqual(s2.map((i) => i.late), [false, false, false]);
  const s3 = installmentStates(inst, 99.99, TODAY);
  assert.equal(s3[0].covered, false);
});

test('allocatePayment: respeita a ordem do pacote, não passa do saldo e devolve a sobra', () => {
  const items = [
    { itemId: 'i2', accountId: 'a2', remaining: 100, sortOrder: 2 },
    { itemId: 'i0', accountId: 'a0', remaining: 150, sortOrder: 0 },
    { itemId: 'i1', accountId: 'a1', remaining: 0, sortOrder: 1 },
  ];
  const r = allocatePayment(items, 200);
  assert.deepEqual(r.allocations.map((a) => [a.itemId, a.amount]), [['i0', 150], ['i2', 50]]);
  assert.equal(r.leftover, 0);
  const over = allocatePayment(items, 300);
  assert.equal(over.leftover, 50);
  assert.deepEqual(allocatePayment(items, 0).allocations, []);
  assert.deepEqual(allocatePayment([{ itemId: 'x', accountId: 'ax', remaining: 0.1, sortOrder: 0 }], 0.3).allocations.map((a) => a.amount), [0.1]);
});

test('paidSoFar: soma o que cada item já abateu (nunca negativo nem acima do saldo original)', () => {
  assert.equal(paidSoFar([{ openAmount: 150, remaining: 0 }, { openAmount: 100, remaining: 40 }, { openAmount: 50, remaining: 50 }]), 210);
  assert.equal(paidSoFar([{ openAmount: 100, remaining: 120 }]), 0); // saldo cresceu (estorno): não é "pago negativo"
});
