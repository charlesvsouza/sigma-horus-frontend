import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccess } from '@/lib/rbac';
import { brl } from '@/lib/currency';
import { computeFinancialAccountBalances } from '@/lib/financial-accounts';
import { remainingAmount, sumMoney } from '@/lib/money';

export default async function DashboardPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  // Esta tela mostra o resumo financeiro CONSOLIDADO da loja (saldo, a
  // receber/pagar) — vazava pra qualquer papel logado, inclusive Membro, que
  // pelo RBAC só tem acesso a "portal" (não a "accounts"). Quem não pode ler
  // accounts cai direto no próprio portal em vez de ver os números da loja.
  if (lodgeId && !(await canLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'read'))) {
    redirect('/dashboard/portal');
  }

  if (!lodgeId) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6 py-16">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/6 bg-sigma-card">
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

  const [accounts, invoices, payments, financialAccounts, transfers] = await withTenant(String(lodgeId), (db) =>
    Promise.all([
      db.account.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, type: true, amount: true, status: true, approvalStatus: true },
      }),
      db.invoice.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, amount: true, status: true },
      }),
      db.payment.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, amount: true, accountId: true, bankAccountId: true, account: { select: { type: true } } },
      }),
      db.financialAccount.findMany({ where: { lodgeId: String(lodgeId) }, select: { id: true, openingBalance: true } }),
      db.accountTransfer.findMany({ where: { lodgeId: String(lodgeId), status: 'approved' }, select: { fromId: true, toId: true, amount: true } }),
    ]),
  );

  // Em aberto = valor da conta menos o que já foi pago dela (conta recebida/paga não conta mais).
  const paidByAccount = new Map<string, number>();
  for (const p of payments) {
    if (p.accountId) paidByAccount.set(p.accountId, sumMoney([paidByAccount.get(p.accountId) ?? 0, Number(p.amount ?? 0)]));
  }
  const openAmount = (type: string) =>
    sumMoney(
      accounts
        .filter((a) => a.type === type && a.approvalStatus !== 'rejected')
        .map((a) => remainingAmount(Number(a.amount ?? 0), paidByAccount.get(a.id) ?? 0)),
    );
  const receivableTotal = openAmount('RECEIVABLE');
  const payableTotal = openAmount('PAYABLE');

  // Saldo em caixa = soma do saldo de todos os caixas e contas bancárias (mesma regra dos Extratos).
  const cashBalance = sumMoney(
    computeFinancialAccountBalances(
      financialAccounts.map((f) => ({ id: f.id, openingBalance: Number(f.openingBalance) })),
      payments.map((p) => ({ bankAccountId: p.bankAccountId, amount: Number(p.amount ?? 0), accountType: p.account?.type ?? 'RECEIVABLE' })),
      transfers.map((t) => ({ fromId: t.fromId, toId: t.toId, amount: Number(t.amount) })),
    ).map((b) => b.saldo),
  );

  const receivedTotal = sumMoney(payments.filter((p) => p.account?.type === 'RECEIVABLE').map((p) => Number(p.amount ?? 0)));
  const pendingAccounts = accounts.filter((a) => a.status === 'pending').length;
  const overdueAccounts = accounts.filter((a) => a.status === 'overdue').length;
  const pendingInvoices = invoices.filter((i) => i.status === 'pending').length;
  const netBalance = sumMoney([receivableTotal, -payableTotal]);

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
        {/* Posição financeira: o que há em caixa hoje e o que ainda está em aberto, com o mesmo peso */}
        <section className="rounded-xl border border-white/6 bg-sigma-card p-6 lg:p-7">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-sand-light">Posição financeira</h2>
            <Link href="/dashboard/relatorios" className="text-xs font-medium text-gold transition hover:text-gold-light">Relatórios</Link>
          </div>

          <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-white/6 bg-white/6 sm:grid-cols-2">
            <div className="bg-sigma-blue-deep/60 p-5">
              <p className="text-xs text-sand-dark">Saldo em caixa</p>
              <p className={`mt-2 font-display text-3xl font-bold tabular-nums ${cashBalance >= 0 ? 'text-sand-light' : 'text-rose-300'}`}>{brl(cashBalance)}</p>
              <p className="mt-1 text-xs text-sand-dark">Somando todos os caixas e contas bancárias.</p>
              <Link href="/dashboard/extratos" className="mt-3 inline-block text-xs font-medium text-gold transition hover:text-gold-light">Ver extratos</Link>
            </div>
            <div className="bg-sigma-blue-deep/60 p-5">
              <p className="text-xs text-sand-dark">A receber menos a pagar (em aberto)</p>
              <p className={`mt-2 font-display text-3xl font-bold tabular-nums ${netBalance >= 0 ? 'text-sand-light' : 'text-rose-300'}`}>{brl(netBalance)}</p>
              <p className="mt-1 text-xs text-sand-dark">O que ainda vai entrar e sair.</p>
              <Link href="/dashboard/contas" className="mt-3 inline-block text-xs font-medium text-gold transition hover:text-gold-light">Ver contas</Link>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/6 bg-white/6">
            <div className="bg-sigma-blue-deep/60 p-4">
              <p className="text-xs text-sand-dark">A receber (em aberto)</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">{brl(receivableTotal)}</p>
            </div>
            <div className="bg-sigma-blue-deep/60 p-4">
              <p className="text-xs text-sand-dark">A pagar (em aberto)</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-rose-300">{brl(payableTotal)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-sand-dark">
            Recebido (acumulado): <span className="font-medium tabular-nums text-gold">{brl(receivedTotal)}</span>
          </p>
        </section>

        {/* Rail: o que exige ação + atalhos */}
        <div className="space-y-5">
          <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Precisa de atenção</h2>
            {nothingPending ? (
              <p className="mt-4 text-sm text-sand-dark">Tudo em dia. Nenhuma pendência no momento.</p>
            ) : (
              <ul className="mt-4 divide-y divide-white/5">
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

          <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
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
                  className="group flex items-center justify-between rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4 transition-all duration-150 hover:border-white/10 hover:bg-sigma-blue-deep/70"
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
