import test from 'node:test';
import assert from 'node:assert/strict';
import { anonymizedVisitor, parseVisitorFields, visitorLodgeLabel } from './visitors.ts';

test('cadastro de visitante: normaliza espaços e e-mail, exige nome, recusa e-mail inválido', () => {
  const r = parseVisitorFields({ name: '  João   da Silva ', email: ' Joao@Loja.ORG ', lodgeName: 'Estrela do Sul', lodgeNumber: '123', degree: 'Mestre', phone: '' });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.fields.name, 'João da Silva');
  assert.equal(r.fields.email, 'joao@loja.org');
  assert.equal(r.fields.phone, null);
  assert.deepEqual(parseVisitorFields({ name: '   ' }), { ok: false, error: 'Informe o nome do irmão visitante.' });
  assert.equal(parseVisitorFields({ name: 'X', email: 'joao@loja' }).ok, false);
});

test('rótulo da loja do visitante e anonimização', () => {
  assert.equal(visitorLodgeLabel({ lodgeName: 'Estrela do Sul', lodgeNumber: '123', orient: 'Niterói', powerName: 'GOB' }), 'Estrela do Sul nº 123 · Oriente de Niterói · GOB');
  assert.equal(visitorLodgeLabel({ lodgeName: null, lodgeNumber: null, orient: null, powerName: null }), '');
  const a = anonymizedVisitor(new Date('2026-09-29T00:00:00Z'));
  assert.equal(a.name, 'Visitante removido');
  assert.equal(a.email, null);
  assert.equal(a.anonymizedAt.toISOString(), '2026-09-29T00:00:00.000Z');
});
