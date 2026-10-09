import assert from 'node:assert/strict';
import test from 'node:test';
import { badge, badgeText, pendingNoticeAccountIds, pendingWithoutConfirmation, plural, sumBadges } from './nav-badges';

const d = (iso: string) => new Date(iso);

test('aviso "Já paguei": recusa posterior invalida os avisos anteriores da conta', () => {
  const notices = [
    { entityId: 'a1', createdAt: d('2026-10-01T10:00:00Z') },
    { entityId: 'a1', createdAt: d('2026-10-02T10:00:00Z') },
    { entityId: 'a2', createdAt: d('2026-10-01T10:00:00Z') },
    { entityId: 'a3', createdAt: d('2026-10-01T10:00:00Z') },
  ];
  const rejections = [{ entityId: 'a2', createdAt: d('2026-10-03T10:00:00Z') }, { entityId: 'a3', createdAt: d('2026-09-30T10:00:00Z') }];
  assert.deepEqual(pendingNoticeAccountIds(notices, rejections).sort(), ['a1', 'a3']);
});

test('recebido em dinheiro: só conta o que ainda não foi confirmado', () => {
  assert.deepEqual(pendingWithoutConfirmation([{ entityId: 'p1' }, { entityId: 'p1' }, { entityId: 'p2' }], [{ entityId: 'p2' }]), ['p1']);
});

test('aviso só existe quando há algo a mostrar', () => {
  assert.equal(badge(0, 'alerta', () => 'x'), null);
  assert.deepEqual(badge(2, 'atencao', (n) => plural(n, 'pagamento', 'pagamentos')), { count: 2, tone: 'atencao', hint: '2 pagamentos' });
  assert.equal(plural(1, 'irmão', 'irmãos'), '1 irmão');
});

test('soma dos avisos e texto curto do número', () => {
  assert.equal(sumBadges([{ count: 2, tone: 'alerta', hint: '' }, undefined, { count: 3, tone: 'atencao', hint: '' }]), 5);
  assert.equal(badgeText(7), '7');
  assert.equal(badgeText(150), '99+');
});
