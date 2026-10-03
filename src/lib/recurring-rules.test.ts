import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addInterval, endNoticeText, lastOccurrenceDue, renewRecurrence, selectEnding, recurringHorizon, RECURRING_LEAD_DAYS, skipPendingOccurrences, isLegacyGeneratedNumber, pendingOccurrences, recurrenceSummary, descriptionForOccurrence, resolveDescriptionPlaceholders, occurrenceDescriptionsPreview } from './recurring-rules';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

test('addInterval: mensal, trimestral e anual', () => {
  assert.equal(iso(addInterval(d('2026-09-10'), 'monthly')), '2026-10-10');
  assert.equal(iso(addInterval(d('2026-09-10'), 'quarterly')), '2026-12-10');
  assert.equal(iso(addInterval(d('2026-09-10'), 'yearly')), '2027-09-10');
  assert.equal(iso(addInterval(d('2026-12-10'), 'monthly')), '2027-01-10');
});

test('addInterval: não estoura o fim do mês (31/jan → 28/fev, não 03/mar)', () => {
  assert.equal(iso(addInterval(d('2026-01-31'), 'monthly')), '2026-02-28');
  assert.equal(iso(addInterval(d('2028-01-31'), 'monthly')), '2028-02-29');
  assert.equal(iso(addInterval(d('2028-02-29'), 'yearly')), '2029-02-28');
});

test('pendingOccurrences: nada quando a próxima data ainda é futura', () => {
  assert.deepEqual(pendingOccurrences(d('2026-10-10'), 'monthly', null, d('2026-09-19')), []);
});

test('pendingOccurrences: no dia do vencimento já conta', () => {
  assert.deepEqual(pendingOccurrences(d('2026-09-19'), 'monthly', null, d('2026-09-19')).map(iso), ['2026-09-19']);
});

test('pendingOccurrences: acumulado de meses parados, da mais antiga para a mais nova', () => {
  const r = pendingOccurrences(d('2026-06-10'), 'monthly', null, d('2026-09-19')).map(iso);
  assert.deepEqual(r, ['2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10']);
});

test('pendingOccurrences: respeita quantas ocorrências faltam', () => {
  const r = pendingOccurrences(d('2026-06-10'), 'monthly', 2, d('2026-09-19')).map(iso);
  assert.deepEqual(r, ['2026-06-10', '2026-07-10']);
  assert.deepEqual(pendingOccurrences(d('2026-06-10'), 'monthly', 0, d('2026-09-19')), []);
});

test('pendingOccurrences: a trava impede laço enorme', () => {
  assert.equal(pendingOccurrences(d('2000-01-10'), 'monthly', null, d('2026-09-19'), 12).length, 12);
});

test('skipPendingOccurrences: pula o período bloqueado e recomeça no próximo vencimento depois de hoje', () => {
  const d = (x: string) => new Date(x + 'T00:00:00Z');
  const r = skipPendingOccurrences(d('2026-06-10'), 'monthly', null, d('2026-10-04'));
  assert.equal(r.nextDueDate.toISOString().slice(0, 10), '2026-10-10');
  assert.equal(r.remaining, null);
  assert.equal(r.isRecurring, true);
  const limited = skipPendingOccurrences(d('2026-06-10'), 'monthly', 6, d('2026-10-04')); // pula jun, jul, ago, set (4)
  assert.equal(limited.remaining, 2);
  assert.equal(limited.isRecurring, true);
  const ended = skipPendingOccurrences(d('2026-06-10'), 'monthly', 3, d('2026-10-04')); // acabaria antes de hoje
  assert.equal(ended.remaining, 0);
  assert.equal(ended.isRecurring, false);
  const untouched = skipPendingOccurrences(d('2026-11-10'), 'monthly', 2, d('2026-10-04'));
  assert.equal(untouched.nextDueDate.toISOString().slice(0, 10), '2026-11-10');
  assert.equal(untouched.remaining, 2);
});

test('isLegacyGeneratedNumber: reconhece o sufixo do código antigo e não o número normal', () => {
  assert.equal(isLegacyGeneratedNumber('COB-202609-0001-1758300000000'), true);
  assert.equal(isLegacyGeneratedNumber('COB-202609-0001-1758300000000-1758400000000'), true);
  assert.equal(isLegacyGeneratedNumber('COB-202609-0001'), false);
  assert.equal(isLegacyGeneratedNumber('MENS-2026'), false);
});

test('resumo da recorrência: o campo conta as repetições depois da primeira', () => {
  assert.equal(recurrenceSummary('2026-09-10', 'monthly', '3'), '= 4 cobranças no total: set/2026 a dez/2026.');
  assert.equal(recurrenceSummary('2026-10-10', 'monthly', '2'), '= 3 cobranças no total: out/2026 a dez/2026.');
  assert.equal(recurrenceSummary('2026-01-31', 'quarterly', '3'), '= 4 cobranças no total: jan/2026 a out/2026.');
  assert.equal(recurrenceSummary('', 'monthly', '3'), '= 4 cobranças no total (a primeira + 3).');
  assert.match(recurrenceSummary('2026-09-10', 'monthly', ''), /sem fim/);
  assert.match(recurrenceSummary('2026-09-10', 'monthly', '0'), /1 ou mais/);
});

test('descrição por ocorrência: troca o mês da 1ª cobrança pelo de cada repetição', () => {
  const set = new Date('2026-09-10T00:00:00Z');
  const out = new Date('2026-10-10T00:00:00Z');
  const jan = new Date('2027-01-10T00:00:00Z');
  assert.equal(descriptionForOccurrence('Mensalidade de setembro', set, out), 'Mensalidade de outubro');
  assert.equal(descriptionForOccurrence('Mensalidade de Setembro de 2026', set, jan), 'Mensalidade de Janeiro de 2027');
  assert.equal(descriptionForOccurrence('MENSALIDADE SETEMBRO/2026', set, out), 'MENSALIDADE OUTUBRO/2026');
  assert.equal(descriptionForOccurrence('Mensalidade set/2026', set, jan), 'Mensalidade jan/2027');
  assert.equal(descriptionForOccurrence('Ref. 09/2026', set, out), 'Ref. 10/2026');
  assert.equal(descriptionForOccurrence('Mensalidade {mês}/{ano}', set, out), 'Mensalidade outubro/2026');
});

test('descrição por ocorrência: não mexe no que não é o mês da 1ª cobrança', () => {
  const set = new Date('2026-09-10T00:00:00Z');
  const out = new Date('2026-10-10T00:00:00Z');
  const mar = new Date('2026-03-10T00:00:00Z');
  const abr = new Date('2026-04-10T00:00:00Z');
  assert.equal(descriptionForOccurrence('Mensalidade de agosto', set, out), 'Mensalidade de agosto');
  assert.equal(descriptionForOccurrence('Contribuição anual', set, out), 'Contribuição anual');
  assert.equal(descriptionForOccurrence('Campanha do mar', mar, abr), 'Campanha do mar'); // "mar" sem ano não é março
  assert.equal(descriptionForOccurrence('Mensalidade de março', mar, abr), 'Mensalidade de abril');
  assert.equal(descriptionForOccurrence('Mensalidade de marco', mar, abr), 'Mensalidade de abril'); // sem acento
  assert.equal(descriptionForOccurrence(null, set, out), null);
});

test('marcadores na 1ª cobrança viram o mês dela', () => {
  assert.equal(resolveDescriptionPlaceholders('Mensalidade {Mês} de {ano}', new Date('2026-09-10T00:00:00Z')), 'Mensalidade setembro de 2026');
});

test('prévia das próximas descrições no formulário', () => {
  assert.deepEqual(occurrenceDescriptionsPreview('Mensalidade de setembro', '2026-09-10', 'monthly', '3'), ['Mensalidade de outubro', 'Mensalidade de novembro', 'Mensalidade de dezembro']);
  assert.deepEqual(occurrenceDescriptionsPreview('Mensalidade {mês}/{ano}', '2026-11-10', 'monthly', '2'), ['Mensalidade dezembro/2026', 'Mensalidade janeiro/2027']);
  assert.deepEqual(occurrenceDescriptionsPreview('', '2026-09-10', 'monthly', '3'), []);
  assert.equal(occurrenceDescriptionsPreview('Mensalidade', '2026-09-10', 'monthly', '').length, 3);
});

test('recurringHorizon: gera até 10 dias antes do vencimento', () => {
  assert.equal(RECURRING_LEAD_DAYS, 10);
  const horizon = recurringHorizon(d('2026-10-26'));
  assert.equal(iso(horizon), '2026-11-05');
  // a de 05/11 já entra em 26/10; a de 06/11 só em 27/10
  assert.ok(d('2026-11-05').getTime() <= horizon.getTime());
  assert.ok(d('2026-11-06').getTime() > horizon.getTime());
});

test('lastOccurrenceDue: vencimento da última cobrança que a mãe ainda vai gerar', () => {
  // mãe da amm139: próxima 05/11, 2 repetições (nov e dez) → última 05/12
  assert.equal(iso(lastOccurrenceDue(d('2026-11-05'), 'monthly', 2)!), '2026-12-05');
  assert.equal(iso(lastOccurrenceDue(d('2026-11-05'), 'monthly', 1)!), '2026-11-05');
  assert.equal(lastOccurrenceDue(d('2026-11-05'), 'monthly', 0), null);
  assert.equal(lastOccurrenceDue(d('2026-11-05'), 'monthly', null), null); // sem fim
  assert.equal(iso(lastOccurrenceDue(d('2026-11-30'), 'monthly', 3)!), '2027-01-30');
  assert.equal(iso(lastOccurrenceDue(d('2026-10-01'), 'quarterly', 2)!), '2027-01-01');
});

test('selectEnding: avisa a 30 dias do fim; sem fim e fora da janela ficam de fora; encerrada recente aparece', () => {
  const base = { recurringInterval: 'monthly', isRecurring: true };
  const rows = [
    { ...base, number: 'A', nextDueDate: d('2026-11-05'), recurringCount: 2 },   // última 05/12
    { ...base, number: 'B', nextDueDate: d('2026-11-05'), recurringCount: 12 },  // última 2027-10 (longe)
    { ...base, number: 'C', nextDueDate: d('2026-11-05'), recurringCount: null }, // sem fim
    { ...base, number: 'D-1700000000000', nextDueDate: d('2026-11-05'), recurringCount: 1 }, // filha do código antigo
    { ...base, number: 'E', isRecurring: false, nextDueDate: d('2027-01-05'), recurringCount: 0 }, // encerrou: última 05/12
    { ...base, number: 'F', isRecurring: false, nextDueDate: d('2026-02-05'), recurringCount: 0 }, // encerrou há muito
  ];
  assert.deepEqual(selectEnding(rows, d('2026-11-05')).map((r) => r.number), ['A', 'E']); // 05/12 está a 30 dias
  assert.deepEqual(selectEnding(rows, d('2026-11-04')).map((r) => r.number), ['E']);      // 05/12 a 31 dias: ainda cedo para A
  const ended = selectEnding(rows, d('2026-12-20')).find((r) => r.number === 'E')!;
  assert.equal(ended.ended, true);
  assert.equal(iso(ended.lastDue), '2026-12-05');
});

test('renewRecurrence: mãe ativa soma repetições; mãe encerrada recomeça no próximo vencimento sem despejar meses', () => {
  const active = renewRecurrence({ nextDueDate: d('2026-12-05'), interval: 'monthly', remaining: 1, isRecurring: true }, 12, d('2026-11-20'));
  assert.deepEqual({ ...active, nextDueDate: iso(active.nextDueDate) }, { nextDueDate: '2026-12-05', remaining: 13, isRecurring: true });
  // encerrada em dezembro (próximo = 05/01); renovada em março: recomeça em 05/03 ou depois, nunca no passado
  const ended = renewRecurrence({ nextDueDate: d('2027-01-05'), interval: 'monthly', remaining: 0, isRecurring: false }, 6, d('2027-03-10'));
  assert.equal(iso(ended.nextDueDate), '2027-04-05');
  assert.equal(ended.remaining, 6);
  const fresh = renewRecurrence({ nextDueDate: d('2027-01-05'), interval: 'monthly', remaining: 0, isRecurring: false }, 6, d('2026-12-20'));
  assert.equal(iso(fresh.nextDueDate), '2027-01-05');
});

test('endNoticeText: resume por mês, cita a última cobrança e as duas saídas', () => {
  const { subject, body } = endNoticeText('AMM 139', [d('2026-12-05'), d('2026-12-05'), d('2027-01-05')]);
  assert.match(subject, /AMM 139/);
  assert.match(body, /2 recorrências terminam em dezembro\/2026/);
  assert.match(body, /1 recorrência termina em janeiro\/2027/);
  assert.match(body, /vencimento em 05\/01\/2027/);
  assert.match(body, /Renovar o período atual/);
  assert.match(body, /Criar outro período/);
});
