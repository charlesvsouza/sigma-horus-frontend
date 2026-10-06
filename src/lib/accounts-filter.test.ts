import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGING_BUCKETS, EMPTY_FILTERS, QUICK_VIEWS, agingFacets, applyFilters, daysLate, describeFilters, isDefaultFilters, reportTitleFor, lineValue, parseFilters, serializeFilters,
  situationFacets, situationOf, totalsOf, type FilterAccount, type Filters,
} from './accounts-filter.ts';

const TODAY = new Date('2026-10-05T00:00:00.000Z');
const acc = (o: Partial<FilterAccount> & { id: string; dueDate: string }): FilterAccount => ({
  title: 'Mensalidade', type: 'RECEIVABLE', amount: 140, paid: 0, status: 'pending', isDues: true, personId: 'p1', personName: 'Carlos', chartAccountId: 'c1', chartName: 'Mensalidades', bankAccountId: null, ...o,
});
const F = (o: Partial<Filters> = {}): Filters => ({ ...EMPTY_FILTERS, ...o });

const ACCOUNTS: FilterAccount[] = [
  acc({ id: 'a', dueDate: '2026-09-21T00:00:00.000Z' }),                                   // vencida há 14 dias
  acc({ id: 'b', dueDate: '2026-08-05T00:00:00.000Z', personId: 'p2', personName: 'Roberto' }), // vencida há 61 dias
  acc({ id: 'c', dueDate: '2026-10-05T00:00:00.000Z' }),                                   // vence hoje: a vencer
  acc({ id: 'd', dueDate: '2026-11-05T00:00:00.000Z', amount: 500, title: 'Taxa de elevação', isDues: false, chartAccountId: 'c2', chartName: 'Taxa de Elevação' }),
  acc({ id: 'e', dueDate: '2026-09-01T00:00:00.000Z', status: 'paid' }),                    // paga
  acc({ id: 'f', dueDate: '2026-09-10T00:00:00.000Z', type: 'PAYABLE', title: 'Aluguel', amount: 800, isDues: false, personId: 'f1', personName: 'Imobiliária', chartAccountId: null, chartName: null }),
  acc({ id: 'g', dueDate: '2026-07-01T00:00:00.000Z', amount: 200, paid: 50, personId: 'p2', personName: 'Roberto' }), // vencida há 96 dias, deve 150
];
const ids = (rows: FilterAccount[]) => rows.map((r) => r.id).sort().join('');

test('situação: vencida só depois do dia do vencimento; vence hoje ainda está em dia', () => {
  assert.equal(situationOf(ACCOUNTS[0], TODAY), 'overdue');
  assert.equal(situationOf(ACCOUNTS[2], TODAY), 'upcoming');
  assert.equal(situationOf(ACCOUNTS[4], TODAY), 'paid');
  assert.equal(daysLate(ACCOUNTS[0], TODAY), 14);
  assert.equal(daysLate(ACCOUNTS[2], TODAY), 0);
  assert.equal(daysLate(ACCOUNTS[4], TODAY), 0);
  assert.equal(lineValue(ACCOUNTS[6]), 150); // saldo
  assert.equal(lineValue(ACCOUNTS[4]), 140); // paga: valor cheio
});

test('filtros por situação, tipo e pessoa', () => {
  assert.equal(ids(applyFilters(ACCOUNTS, F(), TODAY)), 'abcdefg');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ sit: 'overdue' }), TODAY)), 'abfg');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ sit: 'upcoming' }), TODAY)), 'cd');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ sit: 'open' }), TODAY)), 'abcdfg');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ sit: 'paid' }), TODAY)), 'e');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ tipo: 'PAYABLE' }), TODAY)), 'f');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ person: 'p2' }), TODAY)), 'bg');
});

test('faixa de atraso (dias) só pega vencidas', () => {
  assert.equal(ids(applyFilters(ACCOUNTS, F({ daysMin: 1, daysMax: 30 }), TODAY)), 'af');   // a: 14 dias, f: 25 dias
  assert.equal(ids(applyFilters(ACCOUNTS, F({ daysMin: 31, daysMax: 60 }), TODAY)), '');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ daysMin: 91 }), TODAY)), 'g');
});

test('período, categoria, mensalidade, valor e busca', () => {
  assert.equal(ids(applyFilters(ACCOUNTS, F({ from: '2026-10-01', to: '2026-10-31' }), TODAY)), 'c');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ cat: 'c2' }), TODAY)), 'd');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ cat: 'none' }), TODAY)), 'f');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ dues: true }), TODAY)), 'abceg');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ min: '400' }), TODAY)), 'df');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ max: '150', sit: 'open' }), TODAY)), 'abcg');
  assert.equal(ids(applyFilters(ACCOUNTS, F({ q: 'ELEVAÇÃO' }), TODAY)), 'd');        // sem acento e sem caixa
  assert.equal(ids(applyFilters(ACCOUNTS, F({ q: 'roberto mensalidade' }), TODAY)), 'bg'); // todas as palavras
});

test('ordenação', () => {
  const dueAsc = applyFilters(ACCOUNTS, F({ sit: 'open' }), TODAY).map((r) => r.id).join('');
  assert.equal(dueAsc, 'gbfacd');
  assert.equal(applyFilters(ACCOUNTS, F({ sit: 'open', sort: 'amount-desc' }), TODAY)[0].id, 'f');
  assert.equal(applyFilters(ACCOUNTS, F({ sit: 'open', sort: 'due-desc' }), TODAY)[0].id, 'd');
  assert.equal(applyFilters(ACCOUNTS, F({ sit: 'open', sort: 'person' }), TODAY)[0].personName, 'Carlos');
});

test('contagens por situação respeitam os outros filtros', () => {
  const all = situationFacets(ACCOUNTS, F(), TODAY);
  assert.deepEqual({ all: all.all.count, open: all.open.count, overdue: all.overdue.count, upcoming: all.upcoming.count, paid: all.paid.count }, { all: 7, open: 6, overdue: 4, upcoming: 2, paid: 1 });
  assert.equal(all.overdue.total, 140 + 140 + 800 + 150);
  const onlyReceivable = situationFacets(ACCOUNTS, F({ tipo: 'RECEIVABLE' }), TODAY);
  assert.equal(onlyReceivable.overdue.count, 3);
  // a própria situação escolhida não zera as outras contagens
  const withSit = situationFacets(ACCOUNTS, F({ sit: 'paid' }), TODAY);
  assert.equal(withSit.overdue.count, 4);
});

test('faixas de atraso: contagem e valor das vencidas', () => {
  const buckets = agingFacets(ACCOUNTS, F(), TODAY);
  const by = Object.fromEntries(buckets.map((b) => [b.key, b.count]));
  // a: 14 dias, f: 25 dias (1–30); b: 61 dias (61–90); g: 96 dias (90+)
  assert.deepEqual(by, { '1-30': 2, '31-60': 0, '61-90': 1, '90+': 1 });
  assert.equal(buckets.find((b) => b.key === '90+')!.total, 150);
  assert.equal(AGING_BUCKETS.length, 4);
  // com a faixa escolhida, as demais continuam mostrando o seu número
  assert.equal(agingFacets(ACCOUNTS, F({ daysMin: 1, daysMax: 30 }), TODAY).find((b) => b.key === '61-90')!.count, 1);
});

test('vistas rápidas', () => {
  const late30 = QUICK_VIEWS.find((v) => v.key === 'late30')!.apply(TODAY);
  assert.equal(ids(applyFilters(ACCOUNTS, F(late30), TODAY)), 'bg');
  const month = QUICK_VIEWS.find((v) => v.key === 'dues-month')!.apply(TODAY);
  assert.deepEqual({ from: month.from, to: month.to, dues: month.dues }, { from: '2026-10-01', to: '2026-10-31', dues: true });
  assert.equal(ids(applyFilters(ACCOUNTS, F(month), TODAY)), 'c');
  const payableLate = QUICK_VIEWS.find((v) => v.key === 'payable-late')!.apply(TODAY);
  assert.equal(ids(applyFilters(ACCOUNTS, F(payableLate), TODAY)), 'f');
  const noCat = QUICK_VIEWS.find((v) => v.key === 'no-category')!.apply(TODAY);
  assert.equal(ids(applyFilters(ACCOUNTS, F(noCat), TODAY)), 'f');
  const next7 = QUICK_VIEWS.find((v) => v.key === 'next7')!.apply(TODAY);
  assert.equal(ids(applyFilters(ACCOUNTS, F(next7), TODAY)), 'c');
});

test('URL: ida e volta, só o que difere do padrão, valores inválidos ignorados', () => {
  assert.equal(serializeFilters(EMPTY_FILTERS), '');
  assert.ok(isDefaultFilters(EMPTY_FILTERS));
  const f = F({ tipo: 'RECEIVABLE', sit: 'overdue', daysMin: 31, daysMax: 60, from: '2026-10-01', person: 'p1', dues: true, q: 'ouro', sort: 'amount-desc' });
  const qs = serializeFilters(f);
  assert.deepEqual(parseFilters(new URLSearchParams(qs)), f);
  const bad = parseFilters(new URLSearchParams('tipo=XX&sit=hack&de=ontem&amin=abc&ord=zzz'));
  assert.deepEqual(bad, EMPTY_FILTERS);
});

test('descrição dos filtros para o cabeçalho do relatório', () => {
  const lookups = { people: [{ id: 'p1', name: 'Carlos' }], categories: [{ id: 'c1', name: '1.1.01 Mensalidades' }], banks: [{ id: 'b1', name: 'Caixa' }] };
  assert.deepEqual(describeFilters(EMPTY_FILTERS, lookups), []);
  const lines = describeFilters(F({ tipo: 'RECEIVABLE', sit: 'overdue', daysMin: 31, daysMax: 60, from: '2026-10-01', person: 'p1', cat: 'c1', dues: true, min: '100', q: ' ouro ' }), lookups);
  assert.deepEqual(lines, [
    'Somente contas a receber', 'Situação: vencidas', 'Atraso: 31 a 60 dias', 'Vencimento: 01/10/2026 a sem limite', 'Pessoa: Carlos',
    'Categoria: 1.1.01 Mensalidades', 'Somente mensalidades', 'Valor de R$ 100,00', 'Busca: “ouro”',
  ]);
  assert.equal(reportTitleFor('PAYABLE'), 'Contas a pagar');
  assert.equal(reportTitleFor('all'), 'Contas a receber e a pagar');
});

test('totalsOf separa o em aberto (saldo restante) do já liquidado', () => {
  const t = totalsOf([
    acc({ id: '1', dueDate: '2026-09-01T00:00:00.000Z', amount: 100 }),
    acc({ id: '2', dueDate: '2026-09-01T00:00:00.000Z', amount: 100, paid: 40 }),
    acc({ id: '3', dueDate: '2026-09-01T00:00:00.000Z', amount: 124289.94, paid: 124289.94, status: 'paid' }),
    acc({ id: '4', dueDate: '2026-09-01T00:00:00.000Z', type: 'PAYABLE', amount: 30 }),
    acc({ id: '5', dueDate: '2026-09-01T00:00:00.000Z', type: 'PAYABLE', amount: 20, paid: 20, status: 'paid' }),
  ]);
  assert.deepEqual(t.receivableOpen, { value: 160, count: 2 });
  assert.deepEqual(t.receivableDone, { value: 124289.94, count: 1 });
  assert.deepEqual(t.payableOpen, { value: 30, count: 1 });
  assert.deepEqual(t.payableDone, { value: 20, count: 1 });
});
