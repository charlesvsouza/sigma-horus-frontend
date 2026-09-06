import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMapping, detectMapping, resolveByName, scoreMapping } from './member-import.ts';

test('detectMapping identifica nome e campos comuns por alias PT/EN', () => {
  const headers = ['Nome Completo', 'E-mail', 'CPF', 'Telefone', 'Coluna Desconhecida'];
  const mapping = detectMapping(headers);
  assert.equal(mapping.nameIndex, 0);
  assert.equal(mapping.fields.email, 1);
  assert.equal(mapping.fields.cpf, 2);
  assert.equal(mapping.fields.phone, 3);
});

test('detectMapping não acha nome quando a coluna não existe', () => {
  const mapping = detectMapping(['Email', 'Telefone']);
  assert.equal(mapping.nameIndex, null);
});

test('scoreMapping pondera por tier — mais peso em campos essenciais', () => {
  const onlyTier3 = scoreMapping({ notes: 0 });
  const oneTier1 = scoreMapping({ email: 0 });
  assert.ok(oneTier1.score > onlyTier3.score);
});

test('applyMapping descarta linha sem nome como erro e mantém as demais', () => {
  const headers = ['Nome', 'CPF'];
  const mapping = detectMapping(headers);
  const rows = [
    ['João da Silva', '529.982.247-25'],
    ['', '111.111.111-11'],
    ['Maria Souza', ''],
  ];
  const result = applyMapping(headers, rows, mapping);
  assert.equal(result.importableRows, 2);
  assert.equal(result.rowIssues.filter((i) => i.severity === 'error').length, 1);
});

test('applyMapping avisa sobre CPF inválido mas ainda importa a linha', () => {
  const headers = ['Nome', 'CPF'];
  const mapping = detectMapping(headers);
  const result = applyMapping(headers, [['João da Silva', '111.111.111-11']], mapping);
  assert.equal(result.importableRows, 1);
  assert.equal(result.rows[0].body.cpf, '111.111.111-11');
  assert.ok(result.rowIssues.some((i) => i.severity === 'warning' && i.field === 'cpf'));
});

test('applyMapping avisa sobre CPF duplicado no arquivo', () => {
  const headers = ['Nome', 'CPF'];
  const mapping = detectMapping(headers);
  const result = applyMapping(headers, [
    ['João da Silva', '529.982.247-25'],
    ['João da Silva Filho', '529.982.247-25'],
  ], mapping);
  assert.equal(result.importableRows, 2);
  assert.ok(result.rowIssues.some((i) => i.message.includes('duplicado')));
});

test('applyMapping converte data BR para ISO', () => {
  const headers = ['Nome', 'Data de Nascimento'];
  const mapping = detectMapping(headers);
  const result = applyMapping(headers, [['João da Silva', '15/03/1980']], mapping);
  assert.equal(result.rows[0].body.birthDate, new Date(1980, 2, 15).toISOString());
});

test('applyMapping avisa quando a data não é reconhecida, sem travar a linha', () => {
  const headers = ['Nome', 'Data de Nascimento'];
  const mapping = detectMapping(headers);
  const result = applyMapping(headers, [['João da Silva', 'não é uma data']], mapping);
  assert.equal(result.importableRows, 1);
  assert.equal(result.rows[0].body.birthDate, undefined);
  assert.ok(result.rowIssues.some((i) => i.severity === 'warning' && i.field === 'birthDate'));
});

test('detectMapping nunca atribui a mesma coluna a dois campos', () => {
  // "Estado" batia por substring tanto com "state" (alias "estado") quanto com
  // "maritalStatus" (alias "estado civil" contém "estado") — regressão real
  // encontrada testando o wizard ao vivo: o estado civil saía preenchido com a UF.
  const mapping = detectMapping(['Nome', 'Estado']);
  assert.equal(mapping.fields.state, 1);
  assert.equal(mapping.fields.maritalStatus, undefined);
});

test('detectMapping mapeia Estado e Estado Civil para campos diferentes quando ambos existem', () => {
  const mapping = detectMapping(['Nome', 'Estado', 'Estado Civil']);
  assert.equal(mapping.fields.state, 1);
  assert.equal(mapping.fields.maritalStatus, 2);
});

test('resolveByName casa nome existente ignorando acento/caixa', () => {
  const options = [{ id: '1', name: 'REAA' }, { id: '2', name: 'Potência Órion' }];
  assert.deepEqual(resolveByName('reaa', options), { id: '1', matched: true });
  assert.deepEqual(resolveByName('POTENCIA ORION', options), { id: '2', matched: true });
  assert.deepEqual(resolveByName('Rito Inexistente', options), { id: null, matched: false });
  assert.deepEqual(resolveByName(null, options), { id: null, matched: true });
});
