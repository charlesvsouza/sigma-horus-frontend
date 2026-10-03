import test from 'node:test';
import assert from 'node:assert/strict';
import { allMinutesUploaded, canViewMinutes, minutesDegrees, resolveMinutesDegree } from './session-minutes.ts';
import type { DocumentViewer } from './documents.ts';

const viewer = (over: Partial<DocumentViewer>): DocumentViewer => ({ seesAll: false, isCandidate: false, isMemberRole: true, memberId: 'm1', rank: 1, ...over });

test('graus em que a sessão pode ter balaustre: os trabalhados, ou o 1º quando não há graus', () => {
  assert.deepEqual(minutesDegrees({ degrees: [1, 2, 3] }), [1, 2, 3]);
  assert.deepEqual(minutesDegrees({ degrees: [2] }), [2]);
  assert.deepEqual(minutesDegrees({ degrees: [] }), [1]);
  assert.deepEqual(minutesDegrees({ degrees: [], grade: 'Mestre' }), [3]); // sessão antiga, grau em texto
});

test('grau do arquivo: o informado, ou o único possível; nunca um grau que a sessão não trabalha', () => {
  const tri = { degrees: [1, 2, 3] };
  assert.deepEqual(resolveMinutesDegree(tri, 2), { ok: true, degree: 2 });
  assert.deepEqual(resolveMinutesDegree(tri, '3'), { ok: true, degree: 3 });
  assert.equal(resolveMinutesDegree(tri, undefined).ok, false); // 3 graus: precisa dizer qual
  assert.equal(resolveMinutesDegree(tri, 4).ok, false);
  assert.equal(resolveMinutesDegree(tri, 'x').ok, false);
  assert.deepEqual(resolveMinutesDegree({ degrees: [1] }, undefined), { ok: true, degree: 1 });
  assert.equal(resolveMinutesDegree({ degrees: [1] }, 2).ok, false);
  assert.deepEqual(resolveMinutesDegree({ degrees: [] }, ''), { ok: true, degree: 1 });
});

test('a sessão só tranca sozinha quando tem o balaustre de todos os graus trabalhados', () => {
  const tri = { degrees: [1, 2, 3] };
  assert.equal(allMinutesUploaded(tri, []), false);
  assert.equal(allMinutesUploaded(tri, [1, 2]), false);
  assert.equal(allMinutesUploaded(tri, [3, 1, 2]), true);
  assert.equal(allMinutesUploaded({ degrees: [1] }, [1]), true);
  assert.equal(allMinutesUploaded({ degrees: [2] }, [1]), false);
});

test('quem vê cada balaustre: o grau dele ou superior; quem envia vê todos; candidato nenhum', () => {
  assert.equal(canViewMinutes(1, viewer({ rank: 1 })), true);
  assert.equal(canViewMinutes(2, viewer({ rank: 1 })), false); // Aprendiz não vê o de Companheiro
  assert.equal(canViewMinutes(3, viewer({ rank: 2 })), false);
  assert.equal(canViewMinutes(2, viewer({ rank: 3 })), true);
  assert.equal(canViewMinutes(3, viewer({ rank: 4 })), true); // Mestre Instalado
  assert.equal(canViewMinutes(1, viewer({ rank: 0 })), false);
  assert.equal(canViewMinutes(3, viewer({ seesAll: true, isMemberRole: false, rank: 0 })), true);
  assert.equal(canViewMinutes(1, viewer({ isCandidate: true, seesAll: true, rank: 0 })), false);
});
