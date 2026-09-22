import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCategoryLedger, NO_CATEGORY_KEY, type LedgerPaymentInput, type LedgerOpenItemInput } from './category-ledger.ts';

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const tronco = { id: 'c-tronco', code: '1.1.05', name: 'Tronco de Beneficência', category: 'Receitas' };
const social = { id: 'c-social', code: '8.9.03', name: 'Ação Social e Caridade', category: 'Despesas' };
const mens = { id: 'c-mens', code: '1.1.01', name: 'Mensalidades', category: 'Receitas' };

const p = (over: Partial<LedgerPaymentInput> & { id: string; paidAt: Date; amount: number }): LedgerPaymentInput => ({
  accountType: 'RECEIVABLE', title: 'Lançamento', person: null, bank: 'Santander', method: 'manual', chart: tronco, ...over,
});

const payments: LedgerPaymentInput[] = [
  p({ id: 'a', paidAt: d('2026-08-10'), amount: 30.1 }),
  p({ id: 'b', paidAt: d('2026-08-20'), amount: 20.2 }),
  p({ id: 'c', paidAt: d('2026-09-02'), amount: 50, bank: 'Caixa da Loja' }),
  p({ id: 'd', paidAt: d('2026-09-05'), amount: 40, accountType: 'PAYABLE', chart: social, title: 'Cesta básica' }),
  p({ id: 'e', paidAt: d('2026-09-06'), amount: 15, accountType: 'PAYABLE', chart: tronco, title: 'Estorno' }),
  p({ id: 'f', paidAt: d('2026-09-10'), amount: 300, chart: mens }),
  p({ id: 'g', paidAt: d('2026-09-12'), amount: 10, chart: null, title: 'Sem categoria' }),
  p({ id: 'h', paidAt: d('2026-10-05'), amount: 999 }), // depois do período: ignorado
];

const from = d('2026-09-01');
const to = d('2026-09-30');

test('agrupa por categoria, ordena pelo código e deixa "sem categoria" por último', () => {
  const l = buildCategoryLedger(payments, from, to);
  assert.deepEqual(l.groups.map((g) => g.code), ['1.1.01', '1.1.05', '8.9.03', '—']);
  assert.equal(l.groups.at(-1)?.key, NO_CATEGORY_KEY);
});

test('saldo anterior soma o que veio antes do período, em centavos', () => {
  const l = buildCategoryLedger(payments, from, to);
  const t = l.groups.find((g) => g.key === 'c-tronco')!;
  assert.equal(t.opening, 50.3);
});

test('saldo acumulado por linha e fechamento da categoria', () => {
  const t = buildCategoryLedger(payments, from, to).groups.find((g) => g.key === 'c-tronco')!;
  assert.deepEqual(t.rows.map((r) => r.balance), [100.3, 85.3]);
  assert.equal(t.totalIn, 50);
  assert.equal(t.totalOut, 15);
  assert.equal(t.closing, 85.3);
});

test('o que vem depois do período não entra', () => {
  const t = buildCategoryLedger(payments, from, to).groups.find((g) => g.key === 'c-tronco')!;
  assert.equal(t.rows.some((r) => r.id === 'h'), false);
});

test('totais gerais somam as categorias', () => {
  const l = buildCategoryLedger(payments, from, to);
  assert.equal(l.totals.opening, 50.3);
  assert.equal(l.totals.in, 360);
  assert.equal(l.totals.out, 55);
  assert.equal(l.totals.closing, 355.3);
});

test('filtro de direção mostra só entradas ou só saídas, mantendo o saldo anterior', () => {
  const soEntradas = buildCategoryLedger(payments, from, to, 'in');
  assert.equal(soEntradas.totals.out, 0);
  assert.equal(soEntradas.groups.find((g) => g.key === 'c-tronco')!.rows.length, 1);
  const soSaidas = buildCategoryLedger(payments, from, to, 'out');
  assert.equal(soSaidas.totals.in, 0);
  assert.equal(soSaidas.groups.find((g) => g.key === 'c-tronco')!.opening, 50.3);
});

test('categoria sem movimento no período e sem saldo anterior não aparece', () => {
  const l = buildCategoryLedger([p({ id: 'z', paidAt: d('2026-01-10'), amount: 10, chart: social, accountType: 'PAYABLE' }), p({ id: 'y', paidAt: d('2026-09-02'), amount: 5 })], from, to);
  assert.deepEqual(l.groups.map((g) => g.key), ['c-tronco', 'c-social']); // social só pelo saldo anterior (−10)
  assert.equal(l.groups[1].opening, -10);
  const semSocial = buildCategoryLedger([p({ id: 'y', paidAt: d('2026-09-02'), amount: 5 })], from, to);
  assert.deepEqual(semSocial.groups.map((g) => g.key), ['c-tronco']);
});

const o = (over: Partial<LedgerOpenItemInput> & { id: string; dueDate: Date; amount: number }): LedgerOpenItemInput => ({
  accountType: 'RECEIVABLE', title: 'Cobrança em aberto', person: null, bank: null, chart: mens, ...over,
});

test('sem openItems, sem lançamento em aberto: comportamento igual a antes (compatibilidade)', () => {
  const l = buildCategoryLedger(payments, from, to);
  assert.ok(l.groups.every((g) => g.rows.every((r) => r.status === 'paid')));
  assert.equal(l.totals.openIn, 0);
  assert.equal(l.totals.openOut, 0);
});

test('lançamento em aberto aparece na lista mas não mexe no saldo', () => {
  const openItems = [o({ id: 'open1', dueDate: d('2026-09-15'), amount: 220 })];
  const l = buildCategoryLedger(payments, from, to, 'all', openItems);
  const mensGroup = l.groups.find((g) => g.key === 'c-mens')!;
  assert.equal(mensGroup.rows.length, 2); // o pago (f) + o em aberto
  const openRow = mensGroup.rows.find((r) => r.id === 'open1')!;
  assert.equal(openRow.status, 'open');
  assert.equal(openRow.in, 220);
  // saldo da linha em aberto é o mesmo da última linha paga antes dela (não soma o pendente)
  const paidRow = mensGroup.rows.find((r) => r.id === 'f')!;
  assert.equal(openRow.balance, paidRow.balance);
  assert.equal(mensGroup.totalIn, 300); // só o pago
  assert.equal(mensGroup.openIn, 220);
  assert.equal(mensGroup.closing, 300);
  assert.equal(l.totals.openIn, 220);
});

test('categoria só com lançamento em aberto (sem nenhum Payment) ainda aparece', () => {
  const openItems = [o({ id: 'open2', dueDate: d('2026-09-08'), amount: 100, chart: social, accountType: 'PAYABLE' })];
  const l = buildCategoryLedger([], from, to, 'all', openItems);
  const g = l.groups.find((g) => g.key === 'c-social')!;
  assert.equal(g.opening, 0);
  assert.equal(g.totalOut, 0);
  assert.equal(g.openOut, 100);
  assert.equal(g.rows[0].status, 'open');
});

test('em aberto respeita o filtro de direção e o período (por vencimento)', () => {
  const openItems = [
    o({ id: 'openIn', dueDate: d('2026-09-08'), amount: 50, accountType: 'RECEIVABLE' }),
    o({ id: 'openOut', dueDate: d('2026-09-08'), amount: 30, accountType: 'PAYABLE' }),
    o({ id: 'openFora', dueDate: d('2026-08-01'), amount: 999, accountType: 'RECEIVABLE' }), // antes do período
  ];
  const soEntradas = buildCategoryLedger([], from, to, 'in', openItems);
  const g = soEntradas.groups.find((g) => g.key === 'c-mens')!;
  assert.deepEqual(g.rows.map((r) => r.id), ['openIn']);
});

test('categoria marcada no filtro sem nenhum lançamento aparece como "empty", em vez de sumir', () => {
  const l = buildCategoryLedger(payments, from, to, 'all', [], [
    { id: 'c-tronco', code: '1.1.05', name: 'Tronco de Beneficência', category: 'Receitas' }, // tem movimento
    { id: 'c-vazia', code: '1.5.04', name: 'Saldo para Abertura de Escrituração', category: 'Abertura' }, // sem nenhum lançamento
  ]);
  const vazia = l.groups.find((g) => g.key === 'c-vazia')!;
  assert.ok(vazia, 'categoria pedida deve aparecer mesmo vazia');
  assert.equal(vazia.empty, true);
  assert.equal(vazia.rows.length, 0);
  assert.equal(vazia.opening, 0);
  const tronco = l.groups.find((g) => g.key === 'c-tronco')!;
  assert.equal(tronco.empty, false); // já tinha movimento, não é a categoria vazia
});

test('sem categoria marcada (todas), não aparece grupo "empty" nenhum', () => {
  const l = buildCategoryLedger(payments, from, to);
  assert.ok(l.groups.every((g) => g.empty === false));
});
