import assert from 'node:assert/strict';
import test from 'node:test';
import { actorOf, auditPeriodBounds, buildAuditReport, summarizeDetail, type AuditReportInput } from './audit-report';

const e = (over: Partial<AuditReportInput>): AuditReportInput => ({
  id: 'x', action: 'CREATE', entity: 'payment', entityId: 'p1', after: '{}', createdAt: '2026-10-01T15:00:00.000Z', userId: 'u1', userName: 'Ana', ...over,
});

test('período: dias de Brasília, inclusive o último', () => {
  const b = auditPeriodBounds('2026-10-01', '2026-10-02');
  assert.equal(b.gte?.toISOString(), '2026-10-01T03:00:00.000Z');
  assert.equal(b.lte?.toISOString(), '2026-10-03T02:59:59.999Z');
  assert.deepEqual(auditPeriodBounds('lixo', ''), {});
});

test('ator: usuário, ator de sistema e sistema sem nome', () => {
  assert.deepEqual(actorOf(e({})), { key: 'u1', name: 'Ana', system: false });
  assert.equal(actorOf(e({ userId: null, after: '{"actor":"system:asaas-webhook"}' })).name, 'Sistema (aviso automático do Asaas)');
  assert.equal(actorOf(e({ userId: null, after: null })).key, 'system');
  assert.equal(actorOf(e({ userName: null })).name, 'Usuário removido');
});

test('resumo dos detalhes: esconde ruído e objetos, corta o excesso', () => {
  assert.equal(summarizeDetail('{"amount":10,"viaSuperadmin":true,"x":{"a":1},"n":null,"method":"pix"}'), 'valor: 10 · forma de pagamento: pix');
  assert.equal(summarizeDetail('texto solto'), 'texto solto');
  assert.ok(summarizeDetail(JSON.stringify({ a: 'z'.repeat(300) })).length <= 160);
});

test('agrupa por quem, conta por ação e ordena por atividade', () => {
  const r = buildAuditReport([
    e({ id: '1', userId: 'u2', userName: 'Bruno', createdAt: '2026-10-02T12:00:00Z' }),
    e({ id: '2', createdAt: '2026-10-03T12:00:00Z', action: 'UPDATE' }),
    e({ id: '3', createdAt: '2026-10-01T12:00:00Z', after: '{"viaSuperadmin":true}' }),
    e({ id: '4', userId: null, after: '{"actor":"system:cron"}', action: 'DELETE' }),
  ]);
  assert.equal(r.total, 4);
  assert.deepEqual(r.byAction, { CREATE: 2, UPDATE: 1, DELETE: 1 });
  assert.equal(r.actors[0].name, 'Ana');
  assert.deepEqual(r.actors[0].rows.map((x) => x.id), ['3', '2']);
  assert.equal(r.actors[0].rows[0].viaSuperadmin, true);
  assert.deepEqual(r.actors[0].byAction, { CREATE: 1, UPDATE: 1 });
  assert.equal(r.actors.find((a) => a.key === 'system:cron')?.system, true);
});

test('filtra uma pessoa', () => {
  const r = buildAuditReport([e({ id: '1' }), e({ id: '2', userId: 'u2', userName: 'Bruno' })], 'u2');
  assert.equal(r.total, 1);
  assert.equal(r.actors[0].name, 'Bruno');
});
