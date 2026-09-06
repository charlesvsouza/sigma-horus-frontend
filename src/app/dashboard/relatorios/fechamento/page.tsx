import { auth } from '@/lib/auth';
import { getClosingReport } from '@/lib/closing-report';
import FechamentoClient, { type CardSummary } from './FechamentoClient';

export default async function FechamentoPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const from = sp.from ?? `${new Date().getFullYear()}-01-01`;
  const to = sp.to ?? new Date().toISOString().slice(0, 10);

  if (!lodgeId) {
    return <main className="min-h-screen px-6 py-12"><p className="text-sand-dark">Sessão inválida.</p></main>;
  }

  const data = await getClosingReport(String(lodgeId), from, to);

  const receitasDespesasSaldo = data.receitasDespesas.reduce((s, m) => s + m.receita - m.despesa, 0);
  const irmaosComPendencia = data.saldoIrmaos.filter((s) => s.saldo > 0).length;

  const cards: CardSummary[] = [
    { slug: 'balanco', title: 'Balanço Financeiro', keyLabel: 'Saldo atual', keyValue: data.balanco.saldoAtual, format: 'money' },
    { slug: 'balancete', title: 'Balancete de Verificação', keyLabel: 'Contas com movimento', keyValue: data.balancete.length, format: 'count' },
    { slug: 'receitas-despesas', title: 'Receitas × Despesas', keyLabel: 'Saldo do período', keyValue: receitasDespesasSaldo, format: 'money' },
    { slug: 'livro-caixa', title: 'Livro Caixa', keyLabel: 'Lançamentos', keyValue: data.livroCaixa.length, format: 'count' },
    { slug: 'cobrancas', title: 'Cobranças em Geral', keyLabel: 'Total cobrado', keyValue: data.cobrancas.total, format: 'money' },
    { slug: 'saldo-irmaos', title: 'Saldo dos Irmãos', keyLabel: 'Irmãos com pendência', keyValue: irmaosComPendencia, format: 'count' },
  ];

  return <FechamentoClient cards={cards} meta={data.meta} initialFrom={from} initialTo={to} />;
}
