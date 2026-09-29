import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConvocationText, convocationChanged, convocationEligibility, convocationMessage, degreesLabel,
  legacyGradeDegrees, normalizeDegrees, openingDegree, sessionDegrees, stripRectification,
} from './session-convocation.ts';
import { toBRDateTimeLocal, parseBRDateTimeLocal } from './br-time.ts';

test('graus: normaliza, lê o texto livre antigo e rotula', () => {
  assert.deepEqual(normalizeDegrees([2, '1', 2, 7, 'x']), [1, 2]);
  assert.deepEqual(legacyGradeDegrees('Mestre'), [3]);
  assert.deepEqual(legacyGradeDegrees('1º e 2º'), [1, 2]);
  assert.deepEqual(legacyGradeDegrees(''), []);
  assert.deepEqual(sessionDegrees({ degrees: [], grade: 'Companheiro' }), [2]);
  assert.deepEqual(sessionDegrees({ degrees: [3], grade: 'Aprendiz' }), [3]);
  assert.equal(degreesLabel([1, 2]), 'Aprendiz e Companheiro');
  assert.equal(degreesLabel([1, 2, 3]), 'Aprendiz, Companheiro e Mestre');
  assert.equal(degreesLabel([]), null);
  assert.equal(openingDegree([]), 1);
  assert.equal(openingDegree([2, 3]), 2);
});

test('convocação pelo menor grau: abre em Aprendiz convoca todos', () => {
  const aprendiz = { initiationDate: '2025-01-01' };
  const companheiro = { initiationDate: '2024-01-01', elevationDate: '2025-01-01' };
  const mestre = { initiationDate: '2020-01-01', elevationDate: '2021-01-01', exaltationDate: '2022-01-01' };
  const instalado = { ...mestre, installationDate: '2024-06-01' };
  const semMarcos = {};

  for (const m of [aprendiz, companheiro, mestre, semMarcos]) assert.equal(convocationEligibility(m, [1, 2]), 'eligible');
  assert.equal(convocationEligibility(semMarcos, []), 'eligible');

  assert.equal(convocationEligibility(aprendiz, [2, 3]), 'below');
  assert.equal(convocationEligibility(companheiro, [2, 3]), 'eligible');
  assert.equal(convocationEligibility(companheiro, [3]), 'below');
  assert.equal(convocationEligibility(mestre, [3]), 'eligible');
  assert.equal(convocationEligibility(instalado, [3]), 'eligible');
  assert.equal(convocationEligibility(semMarcos, [3]), 'no-degree');
});

const base = {
  lodgeName: 'ARLS Tim Maia',
  title: 'Sessão ordinária',
  date: parseBRDateTimeLocal('2026-10-01T19:30'),
  endDate: parseBRDateTimeLocal('2026-10-01T22:00'),
  type: 'ordinary',
  degrees: [1, 2],
  agenda: '1. Abertura em grau de Aprendiz\n2. Elevação ao grau de Companheiro',
};

test('texto da convocação traz data/hora de Brasília, término, tipo, graus e ordem do dia', () => {
  const text = buildConvocationText(base);
  assert.match(text, /fica convocada a sessão "Sessão ordinária" da ARLS Tim Maia/);
  assert.match(text, /1 de outubro de 2026.*19:30 \(término previsto: 22:00\)/);
  assert.match(text, /Tipo: Ordinária\./);
  assert.match(text, /Graus trabalhados: Aprendiz e Companheiro\./);
  assert.match(text, /Ordem do dia:\n1\. Abertura/);
  assert.doesNotMatch(buildConvocationText({ ...base, degrees: [], agenda: '  ' }), /Graus trabalhados|Ordem do dia/);
});

test('alteração depois do envio é detectada, inclusive quando o enviado era retificação', () => {
  const sent = buildConvocationText(base);
  assert.equal(convocationChanged(sent, sent), false);
  assert.equal(convocationChanged(sent, null), false);
  const moved = buildConvocationText({ ...base, date: parseBRDateTimeLocal('2026-10-02T19:30') });
  assert.equal(convocationChanged(moved, sent), true);
  const rect = convocationMessage(moved, true);
  assert.match(rect, /^RETIFICAÇÃO/);
  assert.equal(stripRectification(rect), moved);
  assert.equal(convocationChanged(moved, rect), false);
});

test('datetime-local de Brasília vai e volta sem deslocar o horário', () => {
  assert.equal(toBRDateTimeLocal(parseBRDateTimeLocal('2026-10-01T19:30')), '2026-10-01T19:30');
});
