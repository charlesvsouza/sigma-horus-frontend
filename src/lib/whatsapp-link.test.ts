import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceNumberFromLogTitle, normalizeWhatsAppPhone, whatsAppLogTitle, whatsAppUrl } from './whatsapp-link.ts';

test('celular com máscara, sem máscara e com +55 viram 55DDDNÚMERO', () => {
  assert.equal(normalizeWhatsAppPhone('(21) 99999-0000'), '5521999990000');
  assert.equal(normalizeWhatsAppPhone('21999990000'), '5521999990000');
  assert.equal(normalizeWhatsAppPhone('+55 21 99999-0000'), '5521999990000');
  assert.equal(normalizeWhatsAppPhone('021 99999-0000'), '5521999990000');
});

test('fixo com DDD (10 dígitos) ganha o 55', () => {
  assert.equal(normalizeWhatsAppPhone('(21) 2222-3333'), '552122223333');
});

test('vazio, curto ou lixo → null', () => {
  assert.equal(normalizeWhatsAppPhone(null), null);
  assert.equal(normalizeWhatsAppPhone(''), null);
  assert.equal(normalizeWhatsAppPhone('99999-0000'), null);
  assert.equal(normalizeWhatsAppPhone('não tem'), null);
  assert.equal(normalizeWhatsAppPhone('+1 415 555 0100 22'), null);
});

test('link do wa.me codifica o texto e aceita ficar sem número', () => {
  assert.equal(whatsAppUrl('5521999990000', 'Olá & até\nlogo'), 'https://wa.me/5521999990000?text=Ol%C3%A1%20%26%20at%C3%A9%0Alogo');
  assert.equal(whatsAppUrl(null, 'oi'), 'https://wa.me/?text=oi');
});

test('título do registro guarda e devolve o número da cobrança', () => {
  assert.equal(invoiceNumberFromLogTitle(whatsAppLogTitle('COB-202609-0043')), 'COB-202609-0043');
  assert.equal(invoiceNumberFromLogTitle('Aviso de cobrança vencida'), null);
});
