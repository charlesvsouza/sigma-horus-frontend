import Link from 'next/link';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { MiniBar } from '@/components/mini-bar';

export default async function DashboardPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6 py-16">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/[6%] bg-sigma-card">
            <svg className="h-7 w-7 text-sand-dark/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-semibold text-sand-light">
            Painel Sigma Horus
          </h1>
          <p className="mt-2 text-sm text-sand-dark">
            Faça login para visualizar o resumo financeiro da sua loja.
          </p>
        </div>
      </main>
    );
  }

  const [accounts, invoices, payments] = await withTenant(String(lodgeId), (db) =>
    Promise.all([
      db.account.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, type: true, amount: true, status: true },
      }),
      db.invoice.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, amount: true, status: true },
      }),
      db.payment.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, amount: true },
      }),
    ]),
  );

  const receivableTotal = accounts
    .filter((a) => a.type === 'RECEIVABLE')
    .reduce((s, a) => s + Number(a.amount ?? 0), 0);

  const payableTotal = accounts
    .filter((a) => a.type === 'PAYABLE')
    .reduce((s, a) => s + Number(a.amount ?? 0), 0);

  const receivedTotal = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const pendingAccounts = accounts.filter((a) => a.status === 'pending').length;
  const overdueAccounts = accounts.filter((a) => a.status === 'overdue').length;
  const pendingInvoices = invoices.filter((i) => i.status === 'pending').length;
  const netBalance = receivableTotal - payableTotal;
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const attention = [
    { href: '/dashboard/contas', label: 'Contas vencidas', value: overdueAccounts, tone: 'rose' as const },
    { href: '/dashboard/contas', label: 'Contas pendentes', value: pendingAccounts, tone: 'gold' as const },
    { href: '/dashboard/cobrancas', label: 'Cobranças pendentes', value: pendingInvoices, tone: 'muted' as const },
  ];
  const toneText: Record<string, string> = { rose: 'text-rose-300', gold: 'text-gold', muted: 'text-sand' };
  const nothingPending = overdueAccounts === 0 && pendingAccounts === 0 && pendingInvoices === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 lg:px-8">
      <div className="animate-slide-up">
        <h1 className="font-display text-2xl font-bold text-sand-light">Visão geral</h1>
        <p className="mt-1 text-sm text-sand-dark">
          Resumo financeiro consolidado da loja
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Âncora: posição financeira da loja */}
        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6 lg:p-7">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-sand-dark">Posição financeira</p>
            <Link href="/dashboard/relatorios" className="text-xs font-medium text-gold transition hover:text-gold-light">Relatórios</Link>
          </div>
          <p className={`mt-4 font-display text-4xl font-bold tabular-nums ${netBalance >= 0 ? 'text-sand-light' : 'text-rose-300'}`}>
            {brl(netBalance)}
          </p>
          <p className="mt-1 text-sm text-sand-dark">Saldo líquido — a receber menos a pagar</p>

          <div className="mt-6 space-y-1">
            <MiniBar value={receivableTotal} total={receivableTotal + payableTotal} color="var(--color-emerald-500)" label="A receber" />
            <MiniBar value={payableTotal} total={receivableTotal + payableTotal} color="var(--color-rose-500)" label="A pagar" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[6%] bg-white/[6%]">
            <div className="bg-sigma-blue-deep/60 p-4">
              <p className="text-xs text-sand-dark">A receber</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">{brl(receivableTotal)}</p>
            </div>
            <div className="bg-sigma-blue-deep/60 p-4">
              <p className="text-xs text-sand-dark">A pagar</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-rose-300">{brl(payableTotal)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-sand-dark">
            Recebido (acumulado): <span className="font-medium tabular-nums text-gold">{brl(receivedTotal)}</span>
          </p>
        </section>

        {/* Rail: o que exige ação + atalhos */}
        <div className="space-y-5">
          <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Precisa de atenção</h2>
            {nothingPending ? (
              <p className="mt-4 text-sm text-sand-dark">Tudo em dia. Nenhuma pendência no momento.</p>
            ) : (
              <ul className="mt-4 divide-y divide-white/[5%]">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link href={a.href} className="group flex items-center justify-between py-2.5 transition-colors">
                      <span className="text-sm text-sand-dark transition-colors group-hover:text-sand-light">{a.label}</span>
                      <span className={`text-lg font-semibold tabular-nums ${a.value > 0 ? toneText[a.tone] : 'text-sand-dark/40'}`}>{a.value}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Ações rápidas</h2>
            <div className="mt-4 space-y-2">
              {[
                { href: '/dashboard/cobrancas', label: 'Nova cobrança', desc: 'Emitir boleto ou Pix' },
                { href: '/dashboard/pagamentos', label: 'Registrar pagamento', desc: 'Baixa manual' },
                { href: '/dashboard/membros', label: 'Gerenciar membros', desc: 'Cadastro e vínculos' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4 transition-all duration-150 hover:border-white/[10%] hover:bg-sigma-blue-deep/70"
                >
                  <div>
                    <p className="text-sm font-medium text-sand/80 transition-colors group-hover:text-sand-light">{item.label}</p>
                    <p className="text-xs text-sand-dark/60">{item.desc}</p>
                  </div>
                  <svg className="h-4 w-4 text-sand-dark/40 transition-colors group-hover:text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
