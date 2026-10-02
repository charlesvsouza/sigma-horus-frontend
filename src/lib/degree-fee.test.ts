import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageDegreeFees, cardGrossUp, checkEligibility, installmentTitle, degreeFeeKind, isDegreeFeeCardRef, splitInstallments, summarizePlan } from './degree-fee.ts';

const d = (s: string) => new Date(s);
const TODAY = d('2026-10-02');

test('divide em cotas mensais e fecha o total exato', () => {
  const cotas = splitInstallments(1000, 6, d('2026-10-10'));
  assert.equal(cotas.length, 6);
  assert.equal(cotas[0].amount, 166.7); // 166,66 + 4 centavos de sobra
  assert.equal(cotas[5].amount, 166.66);
  assert.equal(Math.round(cotas.reduce((s, c) => s + c.amount, 0) * 100), 100000);
  assert.equal(cotas[1].dueDate.toISOString().slice(0, 10), '2026-11-10');
  assert.equal(cotas[5].dueDate.toISOString().slice(0, 10), '2027-03-10');
});

test('fim de mês não pula mês', () => {
  const cotas = splitInstallments(300, 3, d('2026-01-31'));
  assert.deepEqual(cotas.map((c) => c.dueDate.toISOString().slice(0, 10)), ['2026-01-31', '2026-02-28', '2026-03-31']);
});

test('título da cota', () => {
  const def = degreeFeeKind('exaltation')!;
  assert.equal(installmentTitle(def, 3, 6), 'Taxa de Exaltação — cota 3/6');
  assert.equal(installmentTitle(def, 1, 1), 'Taxa de Exaltação (à vista)');
});

test('iniciação: só candidato', () => {
  assert.equal(checkEligibility('initiation', { status: 'candidate' }, null, TODAY).ok, true);
  assert.equal(checkEligibility('initiation', { status: 'active', initiationDate: d('2020-01-01') }, null, TODAY).ok, false);
});

test('elevação: Aprendiz a partir da 4ª instrução', () => {
  const aprendiz = { status: 'active', initiationDate: d('2026-03-01') };
  assert.equal(checkEligibility('elevation', aprendiz, d('2026-07-01'), TODAY).ok, true);
  assert.equal(checkEligibility('elevation', aprendiz, null, TODAY).ok, false); // sem a 4ª instrução
  assert.equal(checkEligibility('elevation', aprendiz, d('2026-12-01'), TODAY).ok, false); // futura
  assert.equal(checkEligibility('elevation', aprendiz, d('2026-01-01'), TODAY).ok, false); // antes da iniciação
  assert.equal(checkEligibility('elevation', { status: 'active', initiationDate: d('2020-01-01'), elevationDate: d('2021-01-01') }, d('2026-07-01'), TODAY).ok, false); // já é Companheiro
});

test('exaltação: Companheiro a partir da 4ª instrução', () => {
  const comp = { status: 'active', initiationDate: d('2025-01-01'), elevationDate: d('2026-02-01') };
  assert.equal(checkEligibility('exaltation', comp, d('2026-06-01'), TODAY).ok, true);
  assert.equal(checkEligibility('exaltation', { status: 'active', initiationDate: d('2025-01-01') }, d('2026-06-01'), TODAY).ok, false); // Aprendiz
});

test('situação: em pagamento, quitado antecipadamente, evento realizado, cancelado', () => {
  const cotas = [
    { amount: 100, dueDate: d('2026-09-10'), status: 'paid', paid: 100 },
    { amount: 100, dueDate: d('2026-10-10'), status: 'pending', paid: 0 },
    { amount: 100, dueDate: d('2026-11-10'), status: 'pending', paid: 0 },
  ];
  const s = summarizePlan({ status: 'active', expectedEventDate: d('2026-10-20') }, cotas, false, TODAY);
  assert.equal(s.situation, 'open');
  assert.equal(s.paid, 100);
  assert.equal(s.open, 200);
  assert.equal(s.cotasAfterEvent, 1); // a de 10/11 vence depois do evento
  const allPaid = cotas.map((c) => ({ ...c, status: 'paid', paid: 100 }));
  assert.equal(summarizePlan({ status: 'active' }, allPaid, false, TODAY).situation, 'paid_waiting');
  assert.equal(summarizePlan({ status: 'active' }, allPaid, true, TODAY).situation, 'event_done');
  const done = summarizePlan({ status: 'active' }, cotas, true, TODAY);
  assert.equal(done.eventDoneWithBalance, true);
  assert.equal(summarizePlan({ status: 'canceled' }, cotas, false, TODAY).situation, 'canceled');
});

test('vencida conta pelo dia (UTC)', () => {
  const s = summarizePlan({ status: 'active' }, [{ amount: 50, dueDate: d('2026-10-01'), status: 'pending', paid: 20 }], false, TODAY);
  assert.equal(s.overdue, 1);
  assert.equal(s.open, 30);
});

test('quem gerencia: Administrador, Venerável e Tesoureiro', () => {
  assert.equal(canManageDegreeFees('treasurer'), true);
  assert.equal(canManageDegreeFees('venerable'), true);
  assert.equal(canManageDegreeFees('secretary'), false);
  assert.equal(canManageDegreeFees('member'), false);
});

test('filiação/regularização: qualquer obreiro, sem 4ª instrução; candidato não', () => {
  assert.equal(checkEligibility('affiliation', { status: 'active', initiationDate: d('2010-01-01'), elevationDate: d('2011-01-01'), exaltationDate: d('2012-01-01') }, null, TODAY).ok, true);
  assert.equal(checkEligibility('affiliation', { status: 'active' }, null, TODAY).ok, true);
  assert.equal(checkEligibility('affiliation', { status: 'candidate' }, null, TODAY).ok, false);
  assert.equal(degreeFeeKind('affiliation')!.chart.code, '1.1.03');
});

test('filiação quitada = "Quitado" (o sistema não detecta a cerimônia)', () => {
  const paid = [{ amount: 100, dueDate: d('2026-09-10'), status: 'paid', paid: 100 }];
  assert.equal(summarizePlan({ status: 'active' }, paid, false, TODAY, false).situation, 'paid');
  assert.equal(summarizePlan({ status: 'active' }, paid, false, TODAY).situation, 'paid_waiting');
});

test('candidato de filiação paga filiação, não iniciação (e vice-versa)', () => {
  assert.equal(checkEligibility('affiliation', { status: 'candidate', admissionKind: 'affiliation' }, null, TODAY).ok, true);
  assert.equal(checkEligibility('initiation', { status: 'candidate', admissionKind: 'affiliation' }, null, TODAY).ok, false);
  assert.equal(checkEligibility('affiliation', { status: 'candidate', admissionKind: 'initiation' }, null, TODAY).ok, false);
  assert.equal(checkEligibility('affiliation', { status: 'art_002', initiationDate: d('2015-01-01') }, null, TODAY).ok, true); // regularização
});

test('cartão: repasse da tarifa faz a loja receber a taxa cheia', () => {
  const fees = { percentOneTime: 2.99, percentInstallment: 3.49, fixed: 0.49 };
  const r = cardGrossUp(1000, 6, fees);
  assert.ok(r.ok);
  if (!r.ok) return;
  // líquido estimado = total × (1 − 3,49%) − 0,49 ≥ 1000
  assert.ok(r.total * (1 - 0.0349) - 0.49 >= 1000);
  assert.ok(r.total * (1 - 0.0349) - 0.49 < 1000.1);
  assert.equal(Math.round(r.total * 100), Math.round(r.installmentValue * 100) * 6);
  assert.equal(Math.round((r.total - 1000) * 100), Math.round(r.surcharge * 100));
  const vista = cardGrossUp(1000, 1, fees);
  assert.ok(vista.ok && vista.total < r.total); // à vista no cartão usa a tarifa menor
});

test('cartão: sem tarifa configurada, recusa; referência do parcelamento', () => {
  assert.equal(cardGrossUp(1000, 3, { percentOneTime: 2.99, percentInstallment: null, fixed: null }).ok, false);
  assert.equal(isDegreeFeeCardRef('dfp:abc'), true);
  assert.equal(isDegreeFeeCardRef('inv123'), false);
});
