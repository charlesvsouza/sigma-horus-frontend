import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addInterval, recurringHorizon, RECURRING_LEAD_DAYS, skipPendingOccurrences, isLegacyGeneratedNumber, pendingOccurrences, recurrenceSummary, descriptionForOccurrence, resolveDescriptionPlaceholders, occurrenceDescriptionsPreview } from './recurring-rules';

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
