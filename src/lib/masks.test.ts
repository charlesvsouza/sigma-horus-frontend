import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCNPJ, isValidCPF, maskCEP, maskCNPJ, maskCPF, maskPhone, maskRG } from './masks.ts';

test('maskCPF formats progressively', () => {
  assert.equal(maskCPF('12345678901'), '123.456.789-01');
  assert.equal(maskCPF('123456'), '123.456');
});

test('maskCNPJ formats a full CNPJ', () => {
  assert.equal(maskCNPJ('11222333000181'), '11.222.333/0001-81');
});

test('maskPhone handles 10 and 11 digits', () => {
  assert.equal(maskPhone('1133334444'), '(11) 3333-4444');
  assert.equal(maskPhone('11988887777'), '(11) 98888-7777');
});

test('maskCEP and maskRG', () => {
  assert.equal(maskCEP('01310100'), '01310-100');
  assert.equal(maskRG('123456789'), '12.345.678-9');
});

test('CPF/CNPJ validation', () => {
  assert.equal(isValidCPF('529.982.247-25'), true);
  assert.equal(isValidCPF('111.111.111-11'), false);
  assert.equal(isValidCNPJ('11.222.333/0001-81'), true);
  assert.equal(isValidCNPJ('11.111.111/1111-11'), false);
});
