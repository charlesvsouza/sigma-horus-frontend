import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getClosingReport } from '@/lib/closing-report';
import { SECOES, type SecaoSlug } from '../types';
import { BalancoSection, BalanceteSection, ReceitasDespesasSection, LivroCaixaSection, CobrancasSection, SaldoIrmaosSection } from '../sections';
import SecaoDetailShell from './SecaoDetailShell';

export default async function FechamentoSecaoPage({ params, searchParams }: { params: Promise<{ secao: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { secao } = await params;
  const sp = await searchParams;
  const entry = SECOES.find((s) => s.slug === secao);
  if (!entry) notFound();

  const session = await auth();
  const lodgeId = session?.user?.lodgeId;
  const from = sp.from ?? `${new Date().getFullYear()}-01-01`;
  const to = sp.to ?? new Date().toISOString().slice(0, 10);

  if (!lodgeId) {
    return <main className="min-h-screen px-6 py-12"><p className="text-sand-dark">Sessão inválida.</p></main>;
  }

  const data = await getClosingReport(String(lodgeId), from, to);
  const slug = entry.slug as SecaoSlug;

  return (
    <SecaoDetailShell title={entry.title} lodgeName={data.meta.lodge} initialFrom={from} initialTo={to} secao={slug}>
      {slug === 'balanco' ? <BalancoSection data={data.balanco} /> : null}
      {slug === 'balancete' ? <BalanceteSection data={data.balancete} /> : null}
      {slug === 'receitas-despesas' ? <ReceitasDespesasSection data={data.receitasDespesas} /> : null}
      {slug === 'livro-caixa' ? <LivroCaixaSection data={data.livroCaixa} saldoAnterior={data.balanco.saldoAnterior} /> : null}
      {slug === 'cobrancas' ? <CobrancasSection data={data.cobrancas} /> : null}
      {slug === 'saldo-irmaos' ? <SaldoIrmaosSection data={data.saldoIrmaos} /> : null}
    </SecaoDetailShell>
  );
}
