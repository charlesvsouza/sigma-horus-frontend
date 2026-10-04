import test from 'node:test';
import assert from 'node:assert/strict';
import { isIncompleteRecord, missingRecordFields, recordRequestText } from './incomplete-record.ts';

test('o que falta: CPF e/ou e-mail (espaços e máscara vazia contam como vazio)', () => {
  assert.deepEqual(missingRecordFields({ cpf: null, email: null }), ['CPF', 'e-mail']);
  assert.deepEqual(missingRecordFields({ cpf: '123.456.789-09', email: '  ' }), ['e-mail']);
  assert.deepEqual(missingRecordFields({ cpf: '..-', email: 'a@b.com' }), ['CPF']);
  assert.deepEqual(missingRecordFields({ cpf: '12345678909', email: 'a@b.com' }), []);
});

test('só ativo e vivo é incompleto; regularizado deixa de ser', () => {
  assert.equal(isIncompleteRecord({ status: 'active', cpf: null, email: 'a@b.com' }), true);
  assert.equal(isIncompleteRecord({ status: 'active', deceased: true, cpf: null, email: null }), false);
  assert.equal(isIncompleteRecord({ status: 'inactive', cpf: null, email: null }), false);
  assert.equal(isIncompleteRecord({ status: 'active', cpf: '12345678909', email: 'a@b.com' }), false);
});

test('texto pede só o que falta', () => {
  assert.match(recordRequestText('João da Silva', 'Loja X', ['CPF', 'e-mail']), /seu CPF e e-mail/);
  assert.match(recordRequestText('João da Silva', 'Loja X', ['e-mail']), /seu e-mail\./);
  assert.match(recordRequestText('João da Silva', 'Loja X', ['e-mail']), /Irmão João,/);
});
