import test from 'node:test';
import assert from 'node:assert/strict';
import { compareOffices, officeRank } from './office-order.ts';

test('cargos de gestão seguem a ordem cerimonial', () => {
  const names = ['Mestre de Cerimônias', 'Tesoureiro', 'Secretário', 'Orador', '2º Vigilante', '1º Vigilante', 'Venerável Mestre'];
  const sorted = names.map((name) => ({ name, order: 1 })).sort(compareOffices).map((o) => o.name);
  assert.deepEqual(sorted, ['Venerável Mestre', '1º Vigilante', '2º Vigilante', 'Orador', 'Secretário', 'Tesoureiro', 'Mestre de Cerimônias']);
});

test('demais cargos vêm depois, pela ordem cadastrada e depois pelo nome', () => {
  const list = [
    { name: 'Guarda do Templo', order: 14 },
    { name: 'Chanceler', order: 7 }, // no REAA fica antes do Mestre de Cerimônias, mas não é cargo de gestão
    { name: 'Mestre de Cerimônias', order: 8 },
    { name: 'Arquiteto', order: 21 },
    { name: 'Bibliotecário', order: 21 },
    { name: 'Venerável Mestre', order: 1 },
  ].sort(compareOffices).map((o) => o.name);
  assert.deepEqual(list, ['Venerável Mestre', 'Mestre de Cerimônias', 'Chanceler', 'Guarda do Templo', 'Arquiteto', 'Bibliotecário']);
});

test('reconhece variações de acento, ordinal e caixa; cargo cadastrado à mão com ordem padrão não sobe', () => {
  assert.equal(officeRank('VENERAVEL MESTRE'), 1);
  assert.equal(officeRank('1o Vigilante'), 2);
  assert.equal(officeRank('Segundo Vigilante'), 3);
  assert.equal(officeRank('  secretario '), 5);
  assert.equal(officeRank('Mestre de Cerimonias'), 7);
  assert.equal(officeRank('Orador Adjunto'), 8); // não é o Orador
  assert.ok(compareOffices({ name: 'Cargo novo', order: 1 }, { name: 'Tesoureiro', order: 6 }) > 0);
});
