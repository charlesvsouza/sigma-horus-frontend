import test from 'node:test';
import assert from 'node:assert/strict';
import { nameMatch, normalizeText, suggestAccounts, suggestionLabel, type SuggestAccount } from './bank-suggest.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const acc = (id: string, member: string | null, balance: number, due = '2026-09-10'): SuggestAccount => ({ accountId: id, title: 'Mensalidade', memberName: member, balance, dueDate: d(due) });

test('normaliza acento, caixa e pontuação', () => {
  assert.equal(normalizeText('PIX RECEBIDO - José  da Silva Jr.'), 'pix recebido jose da silva jr');
});

test('nome: dois nomes na descrição = forte; um = fraco; nenhum = none; ignora "pix", "de", "da"', () => {
  assert.equal(nameMatch('PIX RECEBIDO JOSE DA SILVA', 'José Carlos da Silva'), 'strong');
  assert.equal(nameMatch('TED CARLOS ALBERTO', 'José Carlos da Silva'), 'weak');
  assert.equal(nameMatch('PIX RECEBIDO MARIA SOUZA', 'José Carlos da Silva'), 'none');
  assert.equal(nameMatch('PIX RECEBIDO', 'José Carlos da Silva'), 'none');
  assert.equal(nameMatch('PIX FULANO', null), 'none');
  assert.equal(nameMatch('PIX RECEBIDO ZEZINHO', 'Zezinho'), 'strong'); // nome de uma palavra só
});

test('sugere por valor exato e nome; ordena valor+nome forte primeiro', () => {
  const accounts = [
    acc('a', 'João Pedro Lima', 120),
    acc('b', 'José Carlos da Silva', 120),
    acc('c', 'Ana Costa', 120),
  ];
  const r = suggestAccounts({ amount: 120, description: 'PIX RECEBIDO JOSE CARLOS SILVA' }, accounts);
  assert.deepEqual(r.map((x) => x.accountId), ['b', 'a', 'c']);
  assert.equal(r[0].amountMatch, 'exact');
  assert.equal(r[0].nameMatch, 'strong');
});

test('saldo MENOR que o crédito nunca é sugerido; saldo maior só com o nome batendo (pagamento parcial)', () => {
  const accounts = [acc('menor', 'José Carlos da Silva', 100), acc('maior-nome', 'José Carlos da Silva', 300), acc('maior-sem-nome', 'Ana Costa', 300)];
  const r = suggestAccounts({ amount: 120, description: 'PIX JOSE CARLOS SILVA' }, accounts);
  assert.deepEqual(r.map((x) => x.accountId), ['maior-nome']);
  assert.equal(r[0].amountMatch, 'partial');
});

test('empate: o vencimento mais antigo vem primeiro; limite de resultados', () => {
  const accounts = [acc('novo', 'Ana Costa', 120, '2026-09-10'), acc('antigo', 'Ana Costa', 120, '2026-06-10')];
  assert.deepEqual(suggestAccounts({ amount: 120, description: 'PIX ANA COSTA' }, accounts).map((x) => x.accountId), ['antigo', 'novo']);
  assert.equal(suggestAccounts({ amount: 10, description: 'x' }, Array.from({ length: 9 }, (_, i) => acc(String(i), null, 10)), 3).length, 3);
});

test('rótulos de confiança', () => {
  assert.equal(suggestionLabel({ amountMatch: 'exact', nameMatch: 'strong' }), 'Valor e nome conferem');
  assert.equal(suggestionLabel({ amountMatch: 'exact', nameMatch: 'none' }), 'Valor confere');
  assert.equal(suggestionLabel({ amountMatch: 'partial', nameMatch: 'strong' }), 'Nome confere; valor parcial');
});
