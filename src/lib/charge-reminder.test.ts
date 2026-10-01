import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_REMINDER_MIN_DAYS_OVERDUE, groupReminders, inReminderScope, normalizeReminderScope, overdueMoreThan, reminderHtml, reminderShortText, reminderSubject, reminderText, startOfTodayBR,
  type ReminderItem, type ReminderMember,
} from './charge-reminder.ts';

const NOW = new Date('2026-10-01T15:00:00Z'); // 12h em Brasília
const joao: ReminderMember = { id: 'm1', name: 'João', email: 'joao@x.com' };
const ana: ReminderMember = { id: 'm2', name: 'Álvaro', email: null };

function item(over: Partial<ReminderItem>): ReminderItem {
  return {
    invoiceId: 'i', number: 'COB-1', title: 'Mensalidade', dueDate: '2026-10-20T00:00:00Z', status: 'pending',
    balance: 110, payAmount: 110, lateSentence: null, pixCopyPaste: null, payUrl: null, ...over,
  };
}

test('escopo: padrão "todas"; vencida segue o calendário de Brasília; sem saldo nunca entra', () => {
  assert.equal(normalizeReminderScope(undefined), 'all');
  assert.equal(normalizeReminderScope('overdue'), 'overdue');
  const venceHoje = { dueDate: '2026-10-01T00:00:00Z', status: 'pending', balance: 10 };
  const vencida = { dueDate: '2026-09-30T00:00:00Z', status: 'pending', balance: 10 };
  const daqui3 = { dueDate: '2026-10-04T00:00:00Z', status: 'pending', balance: 10 };
  const longe = { dueDate: '2026-11-10T00:00:00Z', status: 'pending', balance: 10 };
  assert.equal(inReminderScope(venceHoje, 'overdue', NOW), false);
  assert.equal(inReminderScope(vencida, 'overdue', NOW), true);
  assert.equal(inReminderScope(daqui3, 'due', NOW), true);
  assert.equal(inReminderScope(longe, 'due', NOW), false);
  assert.equal(inReminderScope(longe, 'all', NOW), true);
  assert.equal(inReminderScope({ ...longe, balance: 0 }, 'all', NOW), false);
});

test('agrupa por irmão (alfabético), cobranças da mais antiga para a mais nova, total do que pagar hoje', () => {
  const groups = groupReminders([
    { member: joao, item: item({ number: 'COB-2', dueDate: '2026-10-10T00:00:00Z', payAmount: 110 }) },
    { member: ana, item: item({ number: 'COB-9' }) },
    { member: joao, item: item({ number: 'COB-1', dueDate: '2026-09-10T00:00:00Z', payAmount: 114.2 }) },
  ]);
  assert.deepEqual(groups.map((g) => g.member.name), ['Álvaro', 'João']);
  assert.deepEqual(groups[1].items.map((i) => i.number), ['COB-1', 'COB-2']);
  assert.equal(groups[1].total, 224.2);
});

test('e-mail: um bloco por cobrança, cada uma com o próprio Pix; portal para pagar várias juntas', () => {
  const [g] = groupReminders([
    { member: joao, item: item({ number: 'COB-1', dueDate: '2026-09-10T00:00:00Z', payAmount: 114.2, lateSentence: 'Com multa (R$ 2,20) e juros (R$ 2,00) por atraso até hoje, o valor atualizado é R$ 114,20.', pixCopyPaste: 'PIX-AAA' }) },
    { member: joao, item: item({ number: 'COB-2', pixCopyPaste: 'PIX-BBB' }) },
  ]);
  const opts = { lodgeName: 'ARLS Teste', portalUrl: 'https://s.br/dashboard/portal', instructions: null, now: NOW };
  const text = reminderText(g, opts);
  assert.match(text, /Constam 2 cobranças em aberto em seu nome, no total de R\$\s224,20/);
  assert.match(text, /1\) COB-1 — Mensalidade\n {3}Vencida em 10\/09\/2026/);
  assert.match(text, /2\) COB-2 — Mensalidade\n {3}Vence em 20\/10\/2026/);
  assert.ok(text.includes('PIX-AAA') && text.includes('PIX-BBB'));
  assert.match(text, /pagar várias de uma vez/);
  assert.ok(text.endsWith('Fraternalmente, Tesouraria.'));
  const html = reminderHtml(g, opts);
  assert.equal(html.split('PIX-').length - 1, 2);
  assert.match(html, /<a href="https:\/\/s\.br\/dashboard\/portal"/);
  assert.equal(reminderSubject(g, 'ARLS Teste'), '2 cobranças em aberto — ARLS Teste');
});

test('Modo Asaas: link da emitida vira botão; a não emitida vai para o portal', () => {
  const [g] = groupReminders([
    { member: joao, item: item({ number: 'COB-1', payUrl: 'https://asaas.com/i/abc' }) },
    { member: joao, item: item({ number: 'COB-2', dueDate: '2026-11-20T00:00:00Z' }) },
  ]);
  const opts = { lodgeName: 'L', portalUrl: 'https://s.br/dashboard/portal', instructions: null, now: NOW };
  const text = reminderText(g, opts);
  assert.match(text, /Pagar esta cobrança: https:\/\/asaas\.com\/i\/abc/);
  assert.match(text, /2\) COB-2[^]*Pague pelo seu portal/);
  assert.match(reminderHtml(g, opts), />Pagar esta cobrança</);
});

test('Modo Loja sem chave Pix: sem portal, vão os dados bancários uma vez; uma cobrança só no singular', () => {
  const [g] = groupReminders([{ member: joao, item: item({}) }]);
  const text = reminderText(g, { lodgeName: 'L', portalUrl: null, instructions: 'Depósito/TED: Banco X', now: NOW });
  assert.match(text, /Consta 1 cobrança em aberto em seu nome, no valor de/);
  assert.match(text, /Como pagar:\nDepósito\/TED: Banco X/);
  assert.ok(!text.includes('várias de uma vez'));
  assert.equal(reminderSubject(g, 'L'), 'Cobrança em aberto — L');
});

test('HTML escapa nome e título', () => {
  const [g] = groupReminders([{ member: { ...joao, name: 'A<b>' }, item: item({ title: '<script>' }) }]);
  const html = reminderHtml(g, { lodgeName: 'L', portalUrl: null, instructions: null, now: NOW });
  assert.ok(!html.includes('<script>') && !html.includes('A<b>'));
});

test('início do dia em Brasília', () => {
  assert.equal(startOfTodayBR(new Date('2026-10-01T02:00:00Z')).toISOString(), '2026-09-30T03:00:00.000Z');
  assert.equal(startOfTodayBR(NOW).toISOString(), '2026-10-01T03:00:00.000Z');
});

test('aviso automático: só vencidas há MAIS de 30 dias (Brasília)', () => {
  const now = new Date('2026-10-31T15:00:00Z');
  assert.equal(overdueMoreThan('2026-10-01T00:00:00Z', AUTO_REMINDER_MIN_DAYS_OVERDUE, now), false); // 30 dias
  assert.equal(overdueMoreThan('2026-09-30T00:00:00Z', AUTO_REMINDER_MIN_DAYS_OVERDUE, now), true); // 31 dias
  assert.equal(overdueMoreThan('2026-11-10T00:00:00Z', AUTO_REMINDER_MIN_DAYS_OVERDUE, now), false);
});

test('texto curto (WhatsApp/SMS): sem código Pix, com números, total e onde pagar', () => {
  const [g] = groupReminders([
    { member: joao, item: item({ number: 'COB-1', pixCopyPaste: 'PIX-AAA' }) },
    { member: joao, item: item({ number: 'COB-2', pixCopyPaste: 'PIX-BBB' }) },
  ]);
  const t = reminderShortText(g, { lodgeName: 'L', portalUrl: 'https://s.br/dashboard/portal', instructions: null });
  assert.match(t, /constam em aberto 2 cobranças \(COB-1, COB-2\), no total de R\$\s220,00/);
  assert.ok(!t.includes('PIX-'));
  assert.match(t, /Pague pelo seu portal: https:\/\/s\.br\/dashboard\/portal\./);
  const [one] = groupReminders([{ member: joao, item: item({}) }]);
  assert.match(reminderShortText(one, { lodgeName: 'L', portalUrl: null, instructions: 'Pix (chave): x\nDepósito/TED: y' }), /consta em aberto a cobrança COB-1[^]*Como pagar — Pix \(chave\): x \| Depósito\/TED: y\./);
});
