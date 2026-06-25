import Link from 'next/link';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariant } from '@/components/ui/badge';

export default async function DashboardPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6 py-16">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/[6%] bg-sigma-blue-dark/60">
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

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 lg:px-8">
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-sand-light">Visão geral</h1>
        <p className="mt-1 text-sm text-sand-dark">
          Resumo financeiro consolidado da loja
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: 'Contas a receber',
            value: receivableTotal,
            accent: 'text-emerald-300',
            icon: 'arrow-down',
          },
          {
            title: 'Contas a pagar',
            value: payableTotal,
            accent: 'text-rose-300',
            icon: 'arrow-up',
          },
          {
            title: 'Total recebido',
            value: receivedTotal,
            accent: 'text-gold',
            icon: 'check',
          },
          {
            title: 'Saldo líquido',
            value: netBalance,
            accent: netBalance >= 0 ? 'text-emerald-300' : 'text-rose-300',
            icon: netBalance >= 0 ? 'trending-up' : 'trending-down',
          },
        ].map((card) => (
          <div
            key={card.title}
            className="group rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-5 transition-all duration-200 hover:border-white/[10%] hover:bg-sigma-blue-dark/90"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-sand-dark">
                {card.title}
              </p>
              <span className="text-sand-dark/30 transition-colors group-hover:text-sand-dark/50">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {card.icon === 'arrow-down' && <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />}
                  {card.icon === 'arrow-up' && <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />}
                  {card.icon === 'check' && <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                  {card.icon === 'trending-up' && <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />}
                  {card.icon === 'trending-down' && <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />}
                </svg>
              </span>
            </div>
            <p className={`mt-3 text-2xl font-bold ${card.accent} tabular-nums`}>
              {card.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-sand-light">Status financeiro</h2>
            <Link
              href="/dashboard/contas"
              className="text-xs font-medium text-gold transition hover:text-gold-light"
            >
              Ver contas
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Contas pendentes', value: pendingAccounts, badge: 'pending' as BadgeVariant, color: 'text-gold' },
              { label: 'Vencidas', value: overdueAccounts, badge: 'overdue' as BadgeVariant, color: 'text-rose-300' },
              { label: 'Cobranças pendentes', value: pendingInvoices, badge: 'pending' as BadgeVariant, color: 'text-sand' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4 transition-colors hover:border-white/[8%]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-sand-dark">{item.label}</p>
                  <Badge variant={item.badge} dot>{item.value}</Badge>
                </div>
                <p className={`mt-2 text-xl font-semibold tabular-nums ${item.color}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-6">
          <h2 className="text-base font-semibold text-sand-light">Ações rápidas</h2>
          <div className="mt-5 space-y-2">
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
                  <p className="text-sm font-medium text-sand/80 transition-colors group-hover:text-sand-light">
                    {item.label}
                  </p>
                  <p className="text-xs text-sand-dark/60">{item.desc}</p>
                </div>
                <svg className="h-4 w-4 text-sand-dark/40 transition-colors group-hover:text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
