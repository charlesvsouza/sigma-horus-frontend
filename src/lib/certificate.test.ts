import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attendedDegrees, attendedDegreesText, certificateText, nextCertificateNumber, normalizeVerificationCode,
  verificationCode, visitorLodgePhrase,
} from './certificate.ts';

test('graus em que o visitante esteve: Aprendiz só na parte de Aprendiz; Mestre em todos', () => {
  assert.deepEqual(attendedDegrees([1, 2], 'Aprendiz'), [1]);
  assert.deepEqual(attendedDegrees([1, 2], 'Mestre Instalado'), [1, 2]);
  assert.deepEqual(attendedDegrees([1, 2, 3], 'Companheiro'), [1, 2]);
  assert.deepEqual(attendedDegrees([1, 2], null), [1, 2]);
  assert.deepEqual(attendedDegrees([3], 'Aprendiz'), [3]); // não deveria acontecer: não some o grau
  assert.equal(attendedDegreesText([1]), 'nos trabalhos em Grau de Aprendiz');
  assert.equal(attendedDegreesText([1, 2]), 'nos trabalhos dos Graus de Aprendiz e Companheiro');
  assert.equal(attendedDegreesText([]), null);
});

test('loja do visitante sem repetir "Loja" ou "A.R.L.S."', () => {
  assert.equal(visitorLodgePhrase('Estrela do Sul', '123'), 'Loja Estrela do Sul nº 123');
  assert.equal(visitorLodgePhrase('ARLS Estrela do Sul', null), 'ARLS Estrela do Sul');
  assert.equal(visitorLodgePhrase(null, '45'), 'Loja nº 45');
  assert.equal(visitorLodgePhrase(null, null), null);
});

test('texto do certificado', () => {
  const t = certificateText({
    lodgeName: 'ARLS Tim Maia', lodgeOrient: 'Oriente de Rio de Janeiro/RJ', lodgePower: 'GOB',
    visitorName: 'João da Silva', visitorDegree: 'Mestre', visitorLodgeName: 'Estrela do Sul', visitorLodgeNumber: '123',
    visitorOrient: 'Niterói', visitorPower: 'GOB', sessionTypeLabel: 'Ordinária', sessionDateLong: '1 de outubro de 2026', attended: [1, 2],
  });
  assert.equal(t.before, 'A ARLS Tim Maia (GOB), ao Oriente de Rio de Janeiro/RJ, certifica que o Ir∴');
  assert.equal(t.name, 'João da Silva');
  assert.equal(t.after, 'Mestre, do Quadro da Loja Estrela do Sul nº 123, ao Oriente de Niterói (GOB), esteve presente à Sessão Ordinária realizada em 1 de outubro de 2026, nos trabalhos dos Graus de Aprendiz e Companheiro.');

  const bare = certificateText({
    lodgeName: 'A∴R∴L∴S∴ Tim Maia', lodgeOrient: null, lodgePower: null, visitorName: 'X', visitorDegree: null, visitorLodgeName: null,
    visitorLodgeNumber: null, visitorOrient: null, visitorPower: null, sessionTypeLabel: 'Magna', sessionDateLong: '2 de outubro de 2026', attended: [],
  });
  assert.equal(bare.before, 'A∴R∴L∴S∴ Tim Maia, certifica que o Ir∴');
  assert.equal(bare.after, 'esteve presente à Sessão Magna realizada em 2 de outubro de 2026.');
});

test('numeração por loja e ano, e código de verificação', () => {
  assert.equal(nextCertificateNumber([], 2026), 'CP-2026-0001');
  assert.equal(nextCertificateNumber(['CP-2026-0007', 'CP-2025-0099', null, 'CP-2026-0003'], 2026), 'CP-2026-0008');
  const code = verificationCode(new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253]));
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(normalizeVerificationCode(code.toLowerCase().replace('-', ' ')), code);
  assert.equal(normalizeVerificationCode('abc'), null);
});

test('Potência que já tem parênteses não sai com parênteses duplos', async () => {
  const { powerInParens } = await import('./certificate.ts');
  assert.equal(powerInParens('Grande Loja Maçônica do Estado do Rio de Janeiro (GLMERJ)'), '(Grande Loja Maçônica do Estado do Rio de Janeiro – GLMERJ)');
  assert.equal(powerInParens('GOB'), '(GOB)');
  assert.equal(powerInParens('  '), null);
});
