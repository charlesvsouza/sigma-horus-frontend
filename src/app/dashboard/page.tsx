import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { canLodgeAccess, canLodgeAccessFor } from '@/lib/rbac';
import { brl } from '@/lib/currency';
import { computeFinancialAccountBalances } from '@/lib/financial-accounts';
import { remainingAmount, sumMoney } from '@/lib/money';
import { countAccountsByDue, countInvoicesByDue } from '@/lib/dashboard-counts';
import { todayBR } from '@/lib/date-only';
import { overviewScope } from '@/lib/overview-roles';
import { loadOverviewGroups } from '@/lib/overview-server';
import { OverviewAttention, OverviewFollow } from './OverviewGroups';
import { splitOverview } from '@/lib/overview-layout';
import type { OverviewItem } from '@/lib/overview-server';
import { invoiceOpenBalance } from '@/lib/charge-notice';

export default async function DashboardPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  // Visão geral = cargos de gestão (Administrador, Venerável, Tesoureiro, Secretário, Hospitaleiro), cada um com os
  // indicadores da sua área (lib/overview-roles). Obreiro comum e candidato só têm o Meu portal: vão direto para ele.
  const scope = overviewScope(session?.user?.role);
  if (lodgeId && !scope) redirect('/dashboard/portal');

  // Esta tela mostra o resumo financeiro CONSOLIDADO da loja (saldo, a
  // receber/pagar) — vazava pra qualquer papel logado, inclusive Membro, que
  // pelo RBAC só tem acesso a "portal" (não a "accounts"). Quem não pode ler
  // accounts cai direto no próprio portal em vez de ver os números da loja.
  // Cargo com financeiro na Visão geral, mas sem leitura de Contas liberada (matriz de permissões): vê só os demais indicadores.
  const financeAllowed = Boolean(lodgeId && scope?.finance && (await canLodgeAccess(String(lodgeId), session?.user?.role, 'accounts', 'read')));

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

  // Indicadores por cargo (fora a posição financeira).
  const role = String(session?.user?.role ?? '').toLowerCase();
  const groups = await withTenant(String(lodgeId), (db) =>
    loadOverviewGroups(db, String(lodgeId), scope!, { fundos: ['admin', 'venerable', 'hospitaller', 'treasurer'].includes(role), role }),
  );

  if (!financeAllowed) {
    const layout = splitOverview(groups);
    return (
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 lg:px-8">
        <div className="animate-slide-up">
          <h1 className="font-display text-2xl font-bold text-sand-light">Visão geral</h1>
          <p className="mt-1 text-sm text-sand-dark">{role === 'secretary' ? 'O que pede atenção na Secretaria' : 'O que pede atenção na Hospitalaria'}</p>
        </div>
        <OverviewAttention items={layout.attention} />
        <OverviewFollow items={layout.follow} />
      </div>
    );
  }

  const [accounts, invoices, payments, financialAccounts, transfers] = await withTenant(String(lodgeId), (db) =>
    Promise.all([
      db.account.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, type: true, amount: true, dueDate: true, status: true, approvalStatus: true },
      }),
      db.invoice.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, accountId: true, amount: true, status: true, dueDate: true },
      }),
      db.payment.findMany({
        where: { lodgeId: String(lodgeId) },
        select: { id: true, amount: true, accountId: true, bankAccountId: true, account: { select: { type: true } } },
      }),
      db.financialAccount.findMany({ where: { lodgeId: String(lodgeId) }, select: { id: true, name: true, openingBalance: true }, orderBy: { name: 'asc' } }),
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
  const accountBalances = computeFinancialAccountBalances(
    financialAccounts.map((f) => ({ id: f.id, openingBalance: Number(f.openingBalance) })),
    payments.map((p) => ({ bankAccountId: p.bankAccountId, amount: Number(p.amount ?? 0), accountType: p.account?.type ?? 'RECEIVABLE' })),
    transfers.map((t) => ({ fromId: t.fromId, toId: t.toId, amount: Number(t.amount) })),
  );
  const cashBalance = sumMoney(accountBalances.map((b) => b.saldo));
  // O mesmo total, aberto por conta (Caixinha, Conta corrente…): a soma das linhas é o Saldo em caixa.
  const cashByAccount = financialAccounts.map((f) => ({ id: f.id, name: f.name, saldo: accountBalances.find((b) => b.id === f.id)?.saldo ?? Number(f.openingBalance) }));

  // Vencida/pendente pelo VENCIMENTO e pelo saldo em aberto, não pelo status gravado (a conta fica "pending" depois de vencer).
  const today = todayBR();
  const { overdue: overdueAccounts } = countAccountsByDue(
    accounts.map((a) => ({ id: a.id, amount: Number(a.amount ?? 0), dueDate: a.dueDate, status: a.status, approvalStatus: a.approvalStatus })),
    paidByAccount,
    today,
  );
  const { overdue: overdueInvoices } = countInvoicesByDue(
    invoices.map((i) => {
      const account = accounts.find((a) => a.id === i.accountId);
      return { status: i.status, dueDate: i.dueDate, openBalance: invoiceOpenBalance(Number(i.amount ?? 0), account ? { amount: Number(account.amount ?? 0), status: account.status, payments: [{ amount: paidByAccount.get(account.id) ?? 0 }] } : null) };
    }),
    today,
  );

  // Ocorrências de inventário (Arquiteto) aguardando decisão de baixa/reposição —
  // só aparecem para quem decide (cadastro de materiais).
  const canDecideInventory = await canLodgeAccessFor(
    { lodgeId: String(lodgeId), role: session?.user?.role, memberId: session?.user?.memberId },
    'materials',
    'write',
  );
  const pendingIncidents = canDecideInventory
    ? await withTenant(String(lodgeId), (db) => db.materialIncident.count({ where: { lodgeId: String(lodgeId), status: 'open' } }))
    : 0;

  // Vencidos e ocorrências de inventário entram na lista única de atenção (só quando maiores que zero).
  const financeAttention: OverviewItem[] = [
    { key: 'contas-vencidas', label: 'Contas vencidas', value: overdueAccounts, href: '/dashboard/contas?sit=overdue', tone: 'rose' },
    { key: 'cobrancas-vencidas', label: 'Cobranças vencidas', value: overdueInvoices, href: '/dashboard/cobrancas?filtro=overdue', tone: 'rose' },
    ...(canDecideInventory ? [{ key: 'inventario', label: 'Ocorrências de inventário', value: pendingIncidents, href: '/dashboard/materiais', tone: 'gold' as const }] : []),
  ];
  const layout = splitOverview(groups, financeAttention);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 lg:px-8">
      <div className="animate-slide-up">
        <h1 className="font-display text-2xl font-bold text-sand-light">Visão geral</h1>
        <p className="mt-1 text-sm text-sand-dark">O que precisa de você e a situação da loja</p>
      </div>

      <OverviewAttention items={layout.attention} />

      {/* Situação financeira: três números; o saldo por conta fica recolhido */}
      <section aria-labelledby="ov-financeiro" className="rounded-xl border border-white/6 bg-sigma-card p-6">
        <div className="flex items-center justify-between">
          <h2 id="ov-financeiro" className="text-base font-semibold text-sand-light">Situação financeira</h2>
          <Link href="/dashboard/relatorios" className="text-xs font-medium text-gold transition hover:text-gold-light">Relatórios</Link>
        </div>
        <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-white/6 bg-white/6 sm:grid-cols-3">
          <div className="bg-sigma-blue-deep/60 p-5">
            <p className="text-xs text-sand-dark">Saldo em caixa</p>
            <p className={`mt-2 font-display text-2xl font-bold tabular-nums ${cashBalance >= 0 ? 'text-sand-light' : 'text-rose-300'}`}>{brl(cashBalance)}</p>
            <Link href="/dashboard/extratos" className="mt-2 inline-block text-xs font-medium text-gold transition hover:text-gold-light">Ver extratos</Link>
          </div>
          <div className="bg-sigma-blue-deep/60 p-5">
            <p className="text-xs text-sand-dark">A receber (em aberto)</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-emerald-300">{brl(receivableTotal)}</p>
            <Link href="/dashboard/relatorios/contas-a-receber" className="mt-2 inline-block text-xs font-medium text-gold transition hover:text-gold-light">Ver contas a receber</Link>
          </div>
          <div className="bg-sigma-blue-deep/60 p-5">
            <p className="text-xs text-sand-dark">A pagar (em aberto)</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-rose-300">{brl(payableTotal)}</p>
            <Link href="/dashboard/contas?tipo=PAYABLE&sit=open" className="mt-2 inline-block text-xs font-medium text-gold transition hover:text-gold-light">Ver contas a pagar</Link>
          </div>
        </div>
        {cashByAccount.length > 1 ? (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-sand-dark transition-colors hover:text-sand-light">Saldo por conta</summary>
            <ul className="mt-2 space-y-1 border-t border-white/6 pt-2">
              {cashByAccount.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3">
                  <span className="text-sand-dark">{c.name}</span>
                  <span className={`tabular-nums ${c.saldo >= 0 ? 'text-sand' : 'text-rose-300'}`}>{brl(c.saldo)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <OverviewFollow items={layout.follow} />
    </div>
  );
}
