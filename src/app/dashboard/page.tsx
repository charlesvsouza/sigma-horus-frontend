import Link from 'next/link';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';

export default async function DashboardPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-semibold">Painel Sigma Horus</h1>
          <p className="mt-3 text-slate-400">Faça login para visualizar o resumo financeiro da sua lodge.</p>
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
    .filter((account) => account.type === 'RECEIVABLE')
    .reduce((sum, account) => sum + Number(account.amount ?? 0), 0);

  const payableTotal = accounts
    .filter((account) => account.type === 'PAYABLE')
    .reduce((sum, account) => sum + Number(account.amount ?? 0), 0);

  const receivedTotal = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const pendingAccounts = accounts.filter((account) => account.status === 'pending').length;
  const overdueAccounts = accounts.filter((account) => account.status === 'overdue').length;
  const pendingInvoices = invoices.filter((invoice) => invoice.status === 'pending').length;
  const netBalance = receivableTotal - payableTotal;

  const summaryCards = [
    {
      title: 'Contas a receber',
      value: `R$ ${receivableTotal.toFixed(2)}`,
      accent: 'text-emerald-300',
    },
    {
      title: 'Contas a pagar',
      value: `R$ ${payableTotal.toFixed(2)}`,
      accent: 'text-rose-300',
    },
    {
      title: 'Recebido',
      value: `R$ ${receivedTotal.toFixed(2)}`,
      accent: 'text-amber-300',
    },
    {
      title: 'Saldo líquido',
      value: `R$ ${netBalance.toFixed(2)}`,
      accent: netBalance >= 0 ? 'text-emerald-300' : 'text-rose-300',
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold">Painel Sigma Horus</h1>
          <p className="mt-3 text-slate-400">Resumo financeiro consolidado para contas, cobranças e pagamentos.</p>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.title} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-sm text-slate-400">{card.title}</p>
              <p className={`mt-3 text-2xl font-semibold ${card.accent}`}>{card.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Status financeiro</h2>
              <Link href="/dashboard/contas" className="text-sm text-amber-300 hover:text-amber-200">
                Ver contas
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Contas pendentes</p>
                <p className="mt-2 text-2xl font-semibold text-amber-300">{pendingAccounts}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Vencidas</p>
                <p className="mt-2 text-2xl font-semibold text-rose-300">{overdueAccounts}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Cobranças pendentes</p>
                <p className="mt-2 text-2xl font-semibold text-slate-100">{pendingInvoices}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Ações rápidas</h2>
            <div className="mt-6 space-y-3">
              <Link href="/dashboard/cobrancas" className="block rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300 hover:text-white">
                Criar nova cobrança
              </Link>
              <Link href="/dashboard/pagamentos" className="block rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300 hover:text-white">
                Registrar pagamento
              </Link>
              <Link href="/dashboard/membros" className="block rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300 hover:text-white">
                Vincular membros às contas
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
