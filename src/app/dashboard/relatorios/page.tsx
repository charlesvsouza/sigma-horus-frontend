import Link from 'next/link';
import { auth } from '@/lib/auth';
import { requireLodgeAccess } from '@/lib/rbac';

// Índice de Relatórios: um sumário numerado, por natureza do relatório (como o índice de um livro-razão),
// no lugar de quinze itens soltos no menu. Os endereços de cada relatório não mudam.
const SECTIONS: { title: string; items: { href: string; label: string; description: string }[] }[] = [
  {
    title: 'Movimentação financeira',
    items: [
      { href: '/dashboard/relatorios/resumo', label: 'Resumo financeiro', description: 'Posição de entradas, saídas e saldo no período.' },
      { href: '/dashboard/relatorios/contas-recebidas', label: 'Contas recebidas', description: 'Recebimentos efetivados.' },
      { href: '/dashboard/relatorios/contas-pagas', label: 'Contas pagas', description: 'Pagamentos efetivados.' },
      { href: '/dashboard/relatorios/categorias', label: 'Razão por categoria', description: 'Lançamentos por categoria do plano de contas.' },
    ],
  },
  {
    title: 'Contas a receber e a pagar',
    items: [
      { href: '/dashboard/relatorios/contas-a-receber', label: 'Contas a receber', description: 'Valores a receber em aberto.' },
      { href: '/dashboard/relatorios/contas-a-pagar', label: 'Contas a pagar', description: 'Obrigações em aberto.' },
    ],
  },
  {
    title: 'Inadimplência e regularidade',
    items: [
      { href: '/dashboard/relatorios/inadimplencia', label: 'Inadimplência (Art. 002)', description: 'Mensalidades em atraso e enquadramento.' },
      { href: '/dashboard/relatorios/historico-pagamentos', label: 'Histórico de pagamentos', description: 'Pagamentos por irmão.' },
      { href: '/dashboard/relatorios/declaracao-regularidade', label: 'Declaração de regularidade', description: 'Situação do irmão perante a Tesouraria.' },
    ],
  },
  {
    title: 'Planejamento',
    items: [
      { href: '/dashboard/relatorios/orcamento', label: 'Orçamento anual', description: 'Previsto e realizado.' },
      { href: '/dashboard/relatorios/fluxo-caixa', label: 'Fluxo de caixa projetado', description: 'Projeção de entradas e saídas.' },
    ],
  },
  {
    title: 'Prestação de contas',
    items: [
      { href: '/dashboard/relatorios/fechamento', label: 'Fechamento do veneralato', description: 'Encerramento do período.' },
      { href: '/dashboard/relatorios/balancetes', label: 'Balancetes periódicos', description: 'Balancetes mensais.' },
      { href: '/dashboard/relatorios/dre', label: 'DRE comparativo', description: 'Demonstração do resultado do exercício.' },
    ],
  },
  {
    title: 'Cobrança eletrônica',
    items: [
      { href: '/dashboard/relatorios/tarifas', label: 'Tarifas de cobrança (Asaas)', description: 'Tarifas cobradas pelo meio de pagamento.' },
    ],
  },
];

export default async function RelatoriosIndexPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const denied = (text: string) => (
    <main className="min-h-screen px-6 py-12">
      <p className="text-sm text-sand-dark">{text}</p>
    </main>
  );
  if (!lodgeId) return denied('Sessão expirada.');
  const access = await requireLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'read');
  if (!access.ok) return denied('Acesso negado.');

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-bold text-sand-light">Relatórios</h1>
        <p className="mt-1 text-sm text-sand-dark">Índice dos relatórios da Tesouraria, por natureza. Cada um tem filtro de período e exporta em PDF ou CSV.</p>

        <ol className="mt-8 space-y-8">
          {SECTIONS.map((section, index) => (
            <li key={section.title}>
              <h2 className="flex items-baseline gap-3 border-b border-gold/25 pb-2 text-sm font-semibold uppercase tracking-[0.18em] text-gold">
                <span className="tabular-nums" aria-hidden="true">{index + 1}</span>
                {section.title}
              </h2>
              <ul className="divide-y divide-white/5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group flex flex-col gap-0.5 py-3 pl-7 transition-colors hover:bg-white/3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                    >
                      <span className="text-sm font-medium text-sand-light group-hover:text-gold">{item.label}</span>
                      <span className="text-xs text-sand-dark sm:text-right">{item.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
