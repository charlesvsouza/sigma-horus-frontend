export interface Closing {
  meta: { lodge: string; rite: string | null; power: string | null; from: string; to: string };
  balanco: {
    receitas: { code: string; name: string; value: number; pct: number }[];
    despesas: { code: string; name: string; value: number; pct: number }[];
    somaReceitas: number; somaDespesas: number; saldoAnterior: number; saldoAtual: number;
  };
  balancete: { code: string; name: string; category: string; type: string; saldoAnterior: number; debitos: number; creditos: number; saldoAtual: number }[];
  receitasDespesas: { mes: string; receita: number; despesa: number }[];
  livroCaixa: { data: string; nome: string; plano: string; historico: string; value: number; saldo: number }[];
  cobrancas: { items: { number: string; member: string; amount: number; dueDate: string; status: string }[]; total: number };
  saldoIrmaos: { name: string; debito: number; credito: number; saldo: number }[];
}

export const SECOES = [
  { slug: 'balanco', title: 'Balanço Financeiro' },
  { slug: 'balancete', title: 'Balancete de Verificação' },
  { slug: 'receitas-despesas', title: 'Receitas × Despesas' },
  { slug: 'livro-caixa', title: 'Livro Caixa' },
  { slug: 'cobrancas', title: 'Cobranças em Geral' },
  { slug: 'saldo-irmaos', title: 'Saldo dos Irmãos' },
] as const;

export type SecaoSlug = typeof SECOES[number]['slug'];
