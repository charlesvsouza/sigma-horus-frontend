import test from 'node:test';
import assert from 'node:assert/strict';
import { isEmail, isSlug, email, slug, minLen, validateLodgeSignup } from './validation.ts';

test('isEmail', () => {
  assert.equal(isEmail('a@b.com'), true);
  assert.equal(isEmail('  joao@loja.org '), true);
  assert.equal(isEmail('sem-arroba'), false);
  assert.equal(isEmail('a@b'), false);
});

test('isSlug', () => {
  assert.equal(isSlug('loja-estrela'), true);
  assert.equal(isSlug('loja123'), true);
  assert.equal(isSlug('Loja Estrela'), false);
  assert.equal(isSlug('-inicio'), false);
  assert.equal(isSlug('fim-'), false);
});

test('email / slug mensagens', () => {
  assert.match(email('') ?? '', /Informe/);
  assert.match(email('x') ?? '', /inválido/);
  assert.equal(email('a@b.com'), undefined);
  assert.match(slug('ab') ?? '', /3 caracteres/);
  assert.match(slug('Ab C') ?? '', /min/i);
  assert.equal(slug('loja-x'), undefined);
});

test('minLen', () => {
  assert.match(minLen('123', 8, 'A senha') ?? '', /ao menos 8/);
  assert.equal(minLen('12345678', 8), undefined);
});

test('validateLodgeSignup: vazio devolve todos os erros', () => {
  const e = validateLodgeSignup({ name: '', slug: '', adminName: '', adminEmail: '', adminPassword: '' });
  assert.deepEqual(Object.keys(e).sort(), ['adminEmail', 'adminName', 'adminPassword', 'name', 'slug']);
});

test('validateLodgeSignup: válido devolve vazio', () => {
  const e = validateLodgeSignup({ name: 'Loja X', slug: 'loja-x', adminName: 'João', adminEmail: 'joao@x.com', adminPassword: 'segredo12' });
  assert.deepEqual(e, {});
});
