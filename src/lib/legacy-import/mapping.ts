// Tradução das categorias do sistema legado (Cenize/Loje) para o plano de
// contas padrão do Sigma Horus (masonic-reference.ts). É só a SUGESTÃO inicial:
// na tela de importação o tesoureiro pode trocar qualquer uma. Categorias que
// não estão aqui caem na busca por nome parecido (suggestByName) e, se nem
// isso achar, ficam sem categoria — nunca chutamos uma conta.

import { normalizeName } from './values';

export type CategorySuggestion = { code: string | null; how: 'table' | 'rule' | 'name' | 'none' };

type Rule = string | ((isCredit: boolean, favorecido: string) => string | null);

// Chave = "Grupo:Folha" do plano de contas legado (ex.: "Financeiro:Mensalidade").
const TABLE: Record<string, Rule> = {
  'Financeiro:Mensalidade': '1.1.01',
  'Financeiro:Exaltação/Elevação/Iniciação': '1.1.02',
  'Financeiro:Filiação': '1.1.03',
  'Financeiro:Depósito': (c) => (c ? '1.1.04' : null),
  'Financeiro:Tronco de Solidariedade': '1.1.05',
  'Financeiro:Reembolso': (c) => (c ? '1.2.05' : null),
  'Financeiro:Tarifa Bancária': '2.1.06',
  'Financeiro:Contabilidade': '2.1.07',
  // "Cobrança" é quase todo boleto pago à Grande Loja; os poucos restantes
  // (RCPJ, membros) são heterogêneos e ficam para o tesoureiro decidir.
  'Financeiro:Cobrança': (_c, fav) => (normalizeName(fav) === 'GRANDE LOJA' ? '2.1.15' : null),
  'Financeiro:Compra de Ritual': (c) => (c ? '1.2.04' : '8.9.06'),
  'Investimentos:Ganhos de Capital': '1.2.01',
  'Comercial:Compra Camisa Maçonaria': (c) => (c ? '1.2.04' : '8.9.06'),
  'Comercial:Divisão Festa Fim de Ano': (c) => (c ? '1.5.05' : '2.1.11'),
  'Comercial:Divisão Agape': (c) => (c ? '1.5.05' : '2.1.11'),
  'Eventos:Buffet': '2.1.11',
  'Eventos:Aluguel': '2.1.11',
  'Eventos:Bebidas': '2.1.11',
  'Eventos:Musical': '2.1.11',
  'Eventos:Gelo': '2.1.11',
  'Eventos:Diária Churrasqueiro': '2.1.11',
  'AMORIO:Aluguel': '2.1.05',
  'AMORIO:Area gourmet': '2.1.05',
  'Suprimentos:Compra Mercadorias Refeição': '2.1.11',
  'Suprimentos:Despensa': '2.1.14',
  'Suprimentos:Material de Limpeza/Higiene': '2.1.14',
  'Suprimentos:Impressora/Fax': '2.1.04',
};

/** Chave "Grupo:Folha" a partir do caminho do razão/balancete (["Receitas","Financeiro","Mensalidade"]). */
export function categoryKeyFromPath(path: string[]): string | null {
  const p = path.filter(Boolean);
  if (p.length === 0) return null;
  return p.length === 1 ? p[0] : p.slice(-2).join(':');
}

/** A tabela tem regra para esta categoria (mesmo que a regra dê "sem categoria" para este lançamento). */
export function hasTableRule(categoryKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(TABLE, categoryKey.trim());
}

export function suggestFromTable(categoryKey: string, isCredit: boolean, favorecido: string): CategorySuggestion {
  const rule = TABLE[categoryKey.trim()];
  if (rule === undefined) return { code: null, how: 'none' };
  const code = typeof rule === 'function' ? rule(isCredit, favorecido) : rule;
  return { code, how: code ? 'table' : 'none' };
}

/**
 * Sem regra na tabela: procura no plano da loja uma conta de MESMO nome (ignorando acento/caixa) e mesmo
 * tipo (receita × despesa). Só igualdade exata — nome "parecido" engana (ex.: a categoria "Cobrança" do
 * sistema antigo não é a "Tarifas de Cobrança (Asaas)" daqui), e é melhor deixar sem categoria.
 */
export function suggestByName(categoryKey: string, isCredit: boolean, chart: { code: string; name: string; type: string }[]): CategorySuggestion {
  const leaf = normalizeName(categoryKey.split(':').pop() ?? '');
  if (leaf.length < 4) return { code: null, how: 'none' };
  const wanted = isCredit ? 'REVENUE' : 'EXPENSE';
  const exact = chart.find((c) => c.type === wanted && normalizeName(c.name) === leaf);
  return exact ? { code: exact.code, how: 'name' } : { code: null, how: 'none' };
}
