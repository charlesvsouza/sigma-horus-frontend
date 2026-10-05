import test from 'node:test';
import assert from 'node:assert/strict';
import { isIdle, isNearExpiry, minutesLeft, shouldHeartbeat, SESSION_HEARTBEAT_MS, SESSION_IDLE_MS } from './session-idle.ts';

const MIN = 60_000;

test('ocioso só a partir de 30 minutos sem atividade', () => {
  assert.equal(isIdle(0, 29 * MIN), false);
  assert.equal(isIdle(0, 30 * MIN), true);
  assert.equal(isIdle(0, 8 * 60 * MIN), true, 'computador que dormiu e acordou horas depois');
});

test('aviso nos 2 últimos minutos, nunca depois de cair', () => {
  assert.equal(isNearExpiry(0, 27 * MIN), false);
  assert.equal(isNearExpiry(0, 28 * MIN), true);
  assert.equal(isNearExpiry(0, 29 * MIN + 59_000), true);
  assert.equal(isNearExpiry(0, SESSION_IDLE_MS), false);
  assert.equal(minutesLeft(0, 28 * MIN), 2);
  assert.equal(minutesLeft(0, 40 * MIN), 0);
});

test('renova a sessão só com atividade recente e no intervalo de 5 minutos', () => {
  assert.equal(shouldHeartbeat(10 * MIN, 9 * MIN, 11 * MIN), false, 'renovou há menos de 5 min');
  assert.equal(shouldHeartbeat(10 * MIN, 5 * MIN, 10 * MIN + SESSION_HEARTBEAT_MS), false, 'sem atividade nos últimos 5 min não renova');
  assert.equal(shouldHeartbeat(14 * MIN, 5 * MIN, 15 * MIN), true);
  assert.equal(shouldHeartbeat(0, 0, 20 * MIN), false, 'parado: deixa a sessão cair');
});
