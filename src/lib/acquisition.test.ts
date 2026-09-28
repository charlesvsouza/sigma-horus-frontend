import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceFromCookieHeader, sourceFromParams } from './acquisition.ts';

test('canal a partir dos parâmetros: normaliza e dispensa partes vazias', () => {
  assert.equal(sourceFromParams(new URLSearchParams('utm_source=WhatsApp&utm_medium=Grupo Tesoureiros&utm_campaign=fundadoras')), 'whatsapp/grupo-tesoureiros/fundadoras');
  assert.equal(sourceFromParams(new URLSearchParams('utm_source=folheto')), 'folheto');
  assert.equal(sourceFromParams(new URLSearchParams('utm_source=potência&utm_campaign=glmerj')), 'potencia//glmerj');
  assert.equal(sourceFromParams(new URLSearchParams('ref=amm139')), 'amm139');
  assert.equal(sourceFromParams(new URLSearchParams('utm_medium=x')), null);
  assert.equal(sourceFromParams(new URLSearchParams('')), null);
});

test('cookie de origem: lê o valor válido e ignora lixo', () => {
  assert.equal(sourceFromCookieHeader('a=1; sh_src=whatsapp%2Fgrupo%2Ffundadoras; b=2'), 'whatsapp/grupo/fundadoras');
  assert.equal(sourceFromCookieHeader('sh_src=folheto'), 'folheto');
  assert.equal(sourceFromCookieHeader('sh_src=%3Cscript%3E'), null);
  assert.equal(sourceFromCookieHeader('outro=1'), null);
  assert.equal(sourceFromCookieHeader(null), null);
});
