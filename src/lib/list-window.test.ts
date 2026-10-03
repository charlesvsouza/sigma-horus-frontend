import test from 'node:test';
import assert from 'node:assert/strict';
import { historyCutoff, wantsFullHistory } from './list-window.ts';

test('janela de 12 meses a partir de hoje (Brasília), como data-só-dia', () => {
  const c = historyCutoff(new Date('2026-10-03T15:00:00Z'));
  assert.equal(c.toISOString(), '2025-10-03T00:00:00.000Z');
  // 02h UTC ainda é o dia anterior no Brasil
  assert.equal(historyCutoff(new Date('2026-10-03T02:00:00Z')).toISOString(), '2025-10-02T00:00:00.000Z');
  // virada de ano
  assert.equal(historyCutoff(new Date('2026-02-10T12:00:00Z')).toISOString(), '2025-02-10T00:00:00.000Z');
});

test('?historico=tudo liga o histórico completo; qualquer outra coisa não', () => {
  assert.equal(wantsFullHistory('tudo'), true);
  for (const v of [undefined, '', '1', 'sim', ['tudo']]) assert.equal(wantsFullHistory(v as string | string[] | undefined), false);
});
