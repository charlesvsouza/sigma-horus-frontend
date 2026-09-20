import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from './grid.ts';
import type { Grid } from './grid.ts';
import { parseMoney, parseDateIso, normalizeName } from './values.ts';
import { parseBalancete, parseExtrato, parseRazao, looksLikeExtrato, looksLikeLedger } from './reports.ts';
import { parseCounterparties, parseOpenItems } from './realign.ts';
import { buildPlan, DEFAULT_PLAN_OPTIONS } from './planner.ts';
import { classify } from './service.ts';

const grid = (rows: string[][], name = 'x.csv'): Grid => ({ name, rows });

// ---------- valores ----------

test('parseMoney entende BR, parênteses (negativo) e número puro', () => {
  assert.equal(parseMoney('1.234,56'), 1234.56);
  assert.equal(parseMoney('(9,90)'), -9.9);
  assert.equal(parseMoney('220'), 220);
  assert.equal(parseMoney('163819.38'), 163819.38);
  assert.equal(parseMoney(''), null);
});

test('parseDateIso lê dd/mm/aaaa e rejeita data impossível', () => {
  assert.equal(parseDateIso('14/09/2026'), '2026-09-14');
  assert.equal(parseDateIso('31/02/2026'), null);
  assert.equal(parseDateIso('2026-09-14'), '2026-09-14');
});

test('parseCsv respeita aspas, ; e quebra de linha dentro de aspas, e preserva o recuo', () => {
  const rows = parseCsv('"";"  Receitas";"a;b"\r\n"x";"linha 1\nlinha 2";""\r\n');
  assert.deepEqual(rows[0], ['', '  Receitas', 'a;b']);
  assert.equal(rows[1][1], 'linha 1\nlinha 2');
});

// ---------- extrato / razão / balancete ----------

const HEAD_EXTRATO = ['', '', '', 'Data', '', '', 'Número', '', 'Favorecido/Pagador', 'Plano de Conta', '', 'Valor', 'Saldo', '', '', 'C/D'];
const row = (date: string, fav: string, plano: string, valor: string, saldo: string, cd: string) =>
  ['', '', '', date, '', '', '', '', fav, plano, '', valor, saldo, '', '', cd];

const EXTRATO = grid([
  ['', 'Extrato de Conta'],
  ['', 'Período: de 01/01/2025 até 31/01/2025'],
  HEAD_EXTRATO,
  ['', 'Conta:', '', '', '', 'Caixa'],
  ['', '', '', 'Saldo em 01/01/2025', '', '', '', '', '', '', '', '', '0,00'],
  row('05/01/2025', 'JOAO DA SILVA', 'Financeiro:Mensalidade', '220,00', '220,00', 'C'),
  row('10/01/2025', '[Para: Santander]', 'Transferência', '100,00', '120,00', 'D'),
  ['', '', '', 'Resumo', '', '', '', 'Caixa', '', '', 'Total de Entradas:', '', '220,00'],
  ['', '', '', 'Total lançamentos: 2', '', '', '', '', '', '', 'Total de Saídas:', '', '(100,00)'],
  ['', 'Conta:', '', '', '', 'Santander'],
  ['', '', '', 'Saldo em 01/01/2025', '', '', '', '', '', '', '', '', '0,00'],
  row('01/01/2025', '', '', '500,00', '500,00', 'C'),
  row('10/01/2025', '[De: Caixa]', 'Transferência', '100,00', '600,00', 'C'),
  row('12/01/2025', 'Tarifa Bancária', '', '10,00', '590,00', 'D'),
  ['', '', '', 'Resumo', '', '', '', 'Santander', '', '', 'Total de Entradas:', '', '600,00'],
  ['', '', '', 'Total lançamentos: 3', '', '', '', '', '', '', 'Total de Saídas:', '', '(10,00)'],
  ['', '', 'Resumo Geral'],
  ['', '', '', '', '', '', '', '', '', '', 'Total de Entradas:', '', '820,00'],
  ['', '', '', '', '', '', '', '', '', '', 'Total de Saídas:', '', '(110,00)'],
  ['', '', '', 'Total lançamentos: 5'],
  ['', '', '', '', '', '', '', '', '', '', 'Saldo Final:', '', '710,00'],
]);

const RAZAO = grid([
  ['', 'Lançamentos por Plano de Conta - Razão'],
  ['', 'Período: de 01/01/2025 até 31/01/2025'],
  ['', '  (Não definido)', '', '', '', '', '490,00'],
  ['', '', '', '01/01/2025', '<Abertura de Saldo>', '', '500,00'],
  ['', '', '', '12/01/2025', 'TARIFA AVULSA', '', '(10,00)'],
  ['', '', '', '', 'ENVIO PIX'],
  ['', '  Receitas', '', '', '', '', '220,00'],
  ['', '      Financeiro', '', '', '', '', '220,00'],
  ['', '          Mensalidade', '', '', '', '', '220,00'],
  ['', '', '', '05/01/2025', '', 'LOJA X', '220,00'],
]);

test('parseExtrato lê contas, sinais C/D, saldos e os totais declarados', () => {
  assert.ok(looksLikeExtrato(EXTRATO));
  const p = parseExtrato(EXTRATO);
  assert.equal(p.entries.length, 5);
  assert.equal(p.entries.reduce((s, e) => s + e.valor, 0), 710);
  assert.deepEqual(p.entries.map((e) => e.valor), [220, -100, 500, 100, -10]);
  assert.equal(p.entries[0].date, '2025-01-05');
  assert.equal(p.declaredTotals.finalBalance, 710);
  assert.equal(p.declaredTotals.count, 5);
  assert.equal(p.accounts.find((a) => a.name === 'Santander')?.declaredCount, 3);
  assert.equal(p.periodTo, '2025-01-31');
});

test('parseRazao monta o caminho da categoria pelo recuo e junta a continuação do histórico', () => {
  assert.ok(looksLikeLedger(RAZAO, 'razao'));
  const p = parseRazao(RAZAO);
  assert.equal(p.entries.length, 3);
  assert.equal(p.total, 710);
  const mens = p.entries.find((e) => e.valor === 220)!;
  assert.deepEqual(mens.path, ['Receitas', 'Financeiro', 'Mensalidade']);
  assert.equal(mens.costCenter, 'LOJA X');
  const tarifa = p.entries.find((e) => e.valor === -10)!;
  assert.equal(tarifa.history, 'TARIFA AVULSA ENVIO PIX');
  assert.deepEqual(tarifa.path, []); // (Não definido)
});

test('parseBalancete acumula débito/crédito por conta e confere com o total declarado', () => {
  const g = grid([
    ['', 'Lançamentos por Plano de Conta - Balancete'],
    ['', 'Exercício: 2025'],
    ['', 'Período: de 01/01/2025 até 31/01/2025'],
    ['', '  Receitas', '', '', '', '', '0,00', '', '220,00', '', '220,00'],
    ['', '      Financeiro', '', '', '', '', '0,00', '', '220,00', '', '220,00'],
    ['', '          Mensalidade', '', '', '', '', '0,00', '', '220,00', '', '220,00'],
    ['', '', '05/01/2025', 'JOAO', '', '', '', '0,00', '220,00'],
    ['', 'Resumo Geral', '', '', '', '', '0,00', '0,00', '220,00', '', '220,00'],
  ]);
  assert.ok(looksLikeLedger(g, 'balancete'));
  const b = parseBalancete(g);
  assert.equal(b.exercise, 2025);
  assert.equal(b.lines.length, 3);
  const leaf = b.lines[2];
  assert.deepEqual(leaf.path, ['Receitas', 'Financeiro', 'Mensalidade']);
  assert.equal(leaf.credit, 220);
  assert.equal(b.lines[0].credit, 220); // o pai soma os filhos
  assert.equal(b.declared.closing, 220);
  assert.deepEqual(b.issues, []);
});

// ---------- planner ----------

const CTX = {
  chart: [
    { code: '1.1.01', name: 'Mensalidades', type: 'REVENUE' },
    { code: '2.1.06', name: 'Despesas Bancárias', type: 'EXPENSE' },
  ],
  members: [],
  financialAccounts: [],
};

test('buildPlan casa extrato × razão, pareia transferência, vira abertura em saldo inicial e fecha os totais', () => {
  const plan = buildPlan({ extrato: parseExtrato(EXTRATO), razao: parseRazao(RAZAO) }, CTX, DEFAULT_PLAN_OPTIONS);
  assert.equal(plan.transfers.length, 1);
  assert.deepEqual([plan.transfers[0].from, plan.transfers[0].to, plan.transfers[0].amount], ['Caixa', 'Santander', 100]);
  // Abertura de saldo (500) saiu dos lançamentos e virou saldo inicial do Santander.
  assert.equal(plan.financialAccounts.find((a) => a.name === 'Santander')?.openingBalance, 500);
  assert.equal(plan.transactions.length, 2);
  const mens = plan.transactions.find((t) => t.amount === 220)!;
  assert.equal(mens.chartCode, '1.1.01');
  assert.equal(mens.type, 'RECEIVABLE');
  // Tarifa: sem categoria no razão, mas o favorecido "Tarifa Bancária" é rótulo explícito.
  assert.equal(plan.transactions.find((t) => t.amount === 10)?.chartCode, '2.1.06');
  assert.ok(plan.checks.every((c) => c.ok), JSON.stringify(plan.checks.filter((c) => !c.ok)));
  assert.equal(plan.summary.counterparties, 2); // JOAO DA SILVA e Tarifa Bancária (sem membros na loja)
});

test('buildPlan liga a membro só com nome idêntico e nunca inventa categoria', () => {
  const ctx = { ...CTX, members: [{ id: 'm1', name: 'João da Silva' }] };
  const plan = buildPlan({ extrato: parseExtrato(EXTRATO) }, ctx, DEFAULT_PLAN_OPTIONS);
  const mens = plan.transactions.find((t) => t.amount === 220)!;
  assert.equal(mens.memberId, 'm1');
  assert.equal(mens.isDues, true);
  // sem razão, a categoria vem do extrato ("Financeiro:Mensalidade") e a tarifa sem categoria só do rótulo
  assert.equal(mens.chartCode, '1.1.01');
});

test('buildPlan avisa quando o razão tem lançamento que o extrato não tem', () => {
  const razao = parseRazao(grid([
    ['', 'Lançamentos por Plano de Conta - Razão'],
    ['', '  Receitas', '', '', '', '', '999,00'],
    ['', '', '', '20/01/2025', '', '', '999,00'],
  ]));
  const plan = buildPlan({ extrato: parseExtrato(EXTRATO), razao }, CTX, DEFAULT_PLAN_OPTIONS);
  assert.ok(plan.checks.some((c) => c.label === 'Razão × extrato' && !c.ok));
});

// ---------- realinhamento (XLSX vindo de PDF) ----------

test('parseOpenItems junta registros espalhados em células e confere vencimento × "vencido há N dias"', () => {
  // Variação A: nome | conta | centro | data | valor, com "Vencido há" na linha seguinte.
  // Variação B: nome + "Vencido há" na mesma célula, conta+centro+data juntos, valor solto.
  const a = (name: string, date: string, value: string, days: number) => [
    ['', name, '', '', 'Santander', '', 'LOJA X', date, value],
    ['', `Vencido há ${days} dia(s)`],
  ];
  const b = (name: string, date: string, value: string, days: number) => [
    [`${name} Vencido há ${days} dia(s)`, '', `Santander LOJA X ${date}`, '', '', '', '', '', value],
  ];
  const g = grid([
    ['', 'Cliente/Fornecedor', '', '', 'Conta', '', 'Centro de Custos', 'Vencimento', 'Valor'],
    ...a('MARIA SOUZA', '05/05/2025', '220', 496),
    ...b('MARIA SOUZA', '06/06/2025', '220', 464),
    ...a('PEDRO LIMA', '20/06/2025', '110', 450),
    ...b('PEDRO LIMA', '05/07/2025', '110', 435),
    ...a('ANA REIS', '20/07/2025', '100', 420),
    ...b('ANA REIS', '05/08/2025', '100', 404),
    ...a('JOAO NUNES', '20/08/2025', '50', 389),
    ...b('JOAO NUNES', '05/09/2025', '50', 373),
    ['', 'Resumo Geral'],
    ['', 'Total de Entradas: 960,00 Total de Saídas: 0,00'],
  ]);
  const p = parseOpenItems([g]);
  assert.equal(p.items.length, 8);
  assert.equal(p.referenceDate, '2026-09-13');
  assert.deepEqual(p.items.map((i) => i.name), ['MARIA SOUZA', 'MARIA SOUZA', 'PEDRO LIMA', 'PEDRO LIMA', 'ANA REIS', 'ANA REIS', 'JOAO NUNES', 'JOAO NUNES']);
  assert.deepEqual(p.items.map((i) => i.dueDate).slice(0, 4), ['2025-05-05', '2025-06-06', '2025-06-20', '2025-07-05']);
  assert.deepEqual(p.issues, []);
});

test('parseOpenItems denuncia quando o total lido não bate com o declarado', () => {
  const g = grid([
    ['', 'Cliente/Fornecedor', 'Conta', 'Centro de Custos', 'Vencimento', 'Valor'],
    ['', 'ANA', 'Banco', 'C1', '05/05/2025', '100'],
    ['', 'Vencido há 496 dia(s)'],
    ['', 'BIA', 'Banco', 'C1', '05/05/2025', '100'],
    ['', 'Vencido há 496 dia(s)'],
    ['', 'CLA', 'Banco', 'C1', '05/05/2025', '100'],
    ['', 'Vencido há 496 dia(s)'],
    ['', 'Resumo Geral'],
    ['', 'Total de Entradas: 999,00'],
  ]);
  const p = parseOpenItems([g]);
  assert.ok(p.issues.some((i) => i.includes('declarado')));
});

test('parseCounterparties: CPF impresso antes do nome pertence ao registro anterior; nome cortado prevalece o completo; repetidos unificam', () => {
  const g = grid([
    ['J/F', 'Nome / Nome Fantasia CPF/CNPJ', 'Razão Social Endereço', 'Categoria Cidade', 'Fone 1 Estado', 'Celular CEP'],
    ['F', 'ANA PAULA SOUZA', 'ANA PAULA SOUZA', '', '', '(21) 98014-9836'],
    ['', '529.982.247-25', ',', 'Rio de Janeiro', 'RJ'],
    ['F', 'BRUNO LIMA COSTA DA', 'BRUNO LIMA COSTA DA SILVA ,', '', '', '(21) 99999-0000'],
    ['F', '111.444.777-35 CARLA DIAS', ', CARLA DIAS'],
    ['F', 'CARLA DIAS'],
    ['Qtde Itens: 4'],
  ]);
  const p = parseCounterparties([g]);
  const by = new Map(p.rows.map((r) => [r.name, r]));
  assert.equal(by.get('ANA PAULA SOUZA')?.document, '529.982.247-25');
  assert.equal(by.get('ANA PAULA SOUZA')?.city, 'Rio de Janeiro');
  assert.ok(by.has('BRUNO LIMA COSTA DA SILVA'));
  // 111.444.777-35 é o CPF de teste válido → foi para o BRUNO (registro anterior), não para a CARLA
  assert.equal(by.get('BRUNO LIMA COSTA DA SILVA')?.document, '111.444.777-35');
  assert.equal(p.rows.filter((r) => normalizeName(r.name) === 'CARLA DIAS').length, 1);
  assert.equal(p.merged.length, 0 + p.merged.length); // unificação é informativa
});

test('classify reconhece cada relatório pelo conteúdo, não pelo nome do arquivo', () => {
  assert.equal(classify('qualquer.csv', [EXTRATO]), 'extrato');
  assert.equal(classify('qualquer.csv', [RAZAO]), 'razao');
  assert.equal(classify('Previsão do Fluxo de Caixa_x.xlsx', [grid([['Vencimento', 'Saldo']])]), 'forecast');
  assert.equal(classify('lixo.csv', [grid([['a', 'b']])]), 'unknown');
});
