import test from 'node:test';
import assert from 'node:assert/strict';
import { isIncompleteRecord, missingRecordFields, recordMemberEmail, recordRequestText, recordSecretaryEmail } from './incomplete-record.ts';

test('o que falta: CPF e/ou e-mail (espaços e máscara vazia contam como vazio)', () => {
  assert.deepEqual(missingRecordFields({ cpf: null, email: null, birthDate: new Date() }), ['CPF', 'e-mail']);
  assert.deepEqual(missingRecordFields({ cpf: '123.456.789-09', email: '  ', birthDate: '1950-01-01' }), ['e-mail']);
  assert.deepEqual(missingRecordFields({ cpf: '..-', email: 'a@b.com', birthDate: '1950-01-01' }), ['CPF']);
  assert.deepEqual(missingRecordFields({ cpf: '12345678909', email: 'a@b.com', birthDate: '1950-01-01' }), []);
});

test('sem data de nascimento o cadastro também fica incompleto', () => {
  assert.deepEqual(missingRecordFields({ cpf: '12345678909', email: 'a@b.com', birthDate: null }), ['data de nascimento']);
  assert.equal(isIncompleteRecord({ status: 'active', cpf: '12345678909', email: 'a@b.com' }), true);
  assert.match(recordRequestText('João', 'Loja X', ['data de nascimento']), /da sua data de nascimento\./);
});

test('e-mails de aviso: irmão e Secretário', () => {
  const m = recordMemberEmail('João da Silva', 'Loja X', ['CPF', 'data de nascimento'], 'https://x/dashboard/portal');
  assert.match(m.text, /falta CPF e data de nascimento/);
  assert.match(m.text, /Irmão João,/);
  const s = recordSecretaryEmail('Loja X', [{ name: 'A', missing: ['CPF'], hasEmail: true }, { name: 'B', missing: ['e-mail'], hasEmail: false }], 'https://x/p');
  assert.match(s.subject, /^2 cadastros incompletos/);
  assert.match(s.text, /B: falta e-mail \(sem e-mail/);
});

test('só ativo e vivo é incompleto; regularizado deixa de ser', () => {
  assert.equal(isIncompleteRecord({ status: 'active', cpf: null, email: 'a@b.com' }), true);
  assert.equal(isIncompleteRecord({ status: 'active', deceased: true, cpf: null, email: null }), false);
  assert.equal(isIncompleteRecord({ status: 'inactive', cpf: null, email: null }), false);
  assert.equal(isIncompleteRecord({ status: 'active', cpf: '12345678909', email: 'a@b.com', birthDate: '1950-01-01' }), false);
});

test('texto pede só o que falta', () => {
  assert.match(recordRequestText('João da Silva', 'Loja X', ['CPF', 'e-mail']), /seu CPF e e-mail/);
  assert.match(recordRequestText('João da Silva', 'Loja X', ['e-mail']), /seu e-mail\./);
  assert.match(recordRequestText('João da Silva', 'Loja X', ['e-mail']), /Irmão João,/);
});
