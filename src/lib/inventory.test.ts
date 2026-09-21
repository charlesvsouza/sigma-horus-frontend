import test from 'node:test';
import assert from 'node:assert/strict';
import { availableUnits, awaitingReplacement, planResolution, unitsInQuarantine, validateReport } from './inventory.ts';

test('quarentena: só dano/perda pendentes tiram unidades do disponível', () => {
  const list = [
    { kind: 'damage', status: 'open', quantity: 2 },
    { kind: 'loss', status: 'open', quantity: 1 },
    { kind: 'wear', status: 'open', quantity: 5 }, // desgaste não tira de uso
    { kind: 'damage', status: 'written_off', quantity: 4 }, // já saiu do cadastro
    { kind: 'loss', status: 'dismissed', quantity: 3 },
  ];
  assert.equal(unitsInQuarantine(list), 3);
});

test('disponível = cadastrado − emprestado − quarentena, nunca negativo', () => {
  assert.equal(availableUnits({ quantity: 10, issued: 3, quarantined: 2 }), 5);
  assert.equal(availableUnits({ quantity: 2, issued: 2, quarantined: 1 }), 0);
});

test('registro de ocorrência: quantidade inteira, positiva e dentro do cadastrado', () => {
  assert.equal(validateReport({ quantity: 1, materialQuantity: 3, quarantined: 0 }).ok, true);
  assert.equal(validateReport({ quantity: 0, materialQuantity: 3, quarantined: 0 }).ok, false);
  assert.equal(validateReport({ quantity: 1.5, materialQuantity: 3, quarantined: 0 }).ok, false);
  assert.equal(validateReport({ quantity: 3, materialQuantity: 3, quarantined: 1 }).ok, false);
});

test('baixa diminui o cadastro; reposição devolve; troca 1:1 e dispensa não mexem', () => {
  const open = { status: 'open', quantity: 2 };
  assert.deepEqual(planResolution(open, 5, 'write_off'), { ok: true, status: 'written_off', quantityDelta: -2 });
  assert.deepEqual(planResolution(open, 5, 'replace'), { ok: true, status: 'replaced', quantityDelta: 0 });
  assert.deepEqual(planResolution(open, 5, 'dismiss'), { ok: true, status: 'dismissed', quantityDelta: 0 });
  assert.deepEqual(planResolution({ status: 'written_off', quantity: 2 }, 3, 'replace'), { ok: true, status: 'replaced', quantityDelta: 2 });
});

test('não dá baixa maior que o cadastrado nem reabre ocorrência encerrada', () => {
  assert.equal(planResolution({ status: 'open', quantity: 4 }, 3, 'write_off').ok, false);
  for (const status of ['replaced', 'dismissed']) {
    for (const r of ['write_off', 'replace', 'dismiss'] as const) {
      assert.equal(planResolution({ status, quantity: 1 }, 9, r).ok, false, `${status}/${r}`);
    }
  }
  assert.equal(planResolution({ status: 'written_off', quantity: 1 }, 9, 'dismiss').ok, false);
});

test('aguardando reposição: baixa dada + reposição solicitada', () => {
  assert.equal(awaitingReplacement({ status: 'written_off', requestReplacement: true }), true);
  assert.equal(awaitingReplacement({ status: 'written_off', requestReplacement: false }), false);
  assert.equal(awaitingReplacement({ status: 'open', requestReplacement: true }), false);
});
