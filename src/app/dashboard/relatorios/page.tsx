import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function RelatoriosPage() {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  if (!lodgeId) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-semibold">Relatórios</h1>
          <p className="mt-3 text-slate-400">Faça login para ver o fluxo financeiro da lodge.</p>
        </div>
      </main>
    );
  }

  const [accounts, invoices, payments] = await Promise.all([
    prisma.account.findMany({
      where: { lodgeId: String(lodgeId) },
      select: {
        id: true,
        title: true,
        type: true,
        amount: true,
        dueDate: true,
        status: true,
      },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.invoice.findMany({
      where: { lodgeId: String(lodgeId) },
      select: {
        id: true,
        number: true,
        amount: true,
        dueDate: true,
        status: true,
      },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.payment.findMany({
      where: { lodgeId: String(lodgeId) },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        method: true,
      },
      orderBy: { paidAt: 'desc' },
    }),
  ]);

  const receivables = accounts.filter((account) => account.type === 'RECEIVABLE');
  const payables = accounts.filter((account) => account.type === 'PAYABLE');
  const openReceivables = receivables.filter((account) => account.status !== 'paid');
  const openPayables = payables.filter((account) => account.status !== 'paid');
  const totalReceivables = receivables.reduce((sum, account) => sum + Number(account.amount ?? 0), 0);
  const totalPayables = payables.reduce((sum, account) => sum + Number(account.amount ?? 0), 0);
  const totalPayments = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const netFlow = totalPayments - totalPayables;

  const upcoming = [...receivables, ...payables]
    .filter((item) => item.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 6);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold">Relatórios financeiros</h1>
          <p className="mt-3 text-slate-400">Extrato resumido, contas abertas e fluxo de caixa do período.</p>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">A receber</p>
            <p className="mt-3 text-2xl font-semibold text-emerald-300">R$ {totalReceivables.toFixed(2)}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">A pagar</p>
            <p className="mt-3 text-2xl font-semibold text-rose-300">R$ {totalPayables.toFixed(2)}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Pagamentos registrados</p>
            <p className="mt-3 text-2xl font-semibold text-amber-300">R$ {totalPayments.toFixed(2)}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Fluxo líquido</p>
            <p className={`mt-3 text-2xl font-semibold ${netFlow >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>R$ {netFlow.toFixed(2)}</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Resumo de abertura</h2>
              <Link href="/dashboard/contas" className="text-sm text-amber-300 hover:text-amber-200">
                Ver contas
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Contas a receber abertas</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-300">{openReceivables.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Contas a pagar abertas</p>
                <p className="mt-2 text-2xl font-semibold text-rose-300">{openPayables.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Próximos vencimentos</h2>
            <div className="mt-6 space-y-3">
              {upcoming.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.title}</span>
                    <span className={item.type === 'RECEIVABLE' ? 'text-emerald-300' : 'text-rose-300'}>{item.type === 'RECEIVABLE' ? 'Receber' : 'Pagar'}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Vence em {new Date(item.dueDate).toLocaleDateString('pt-BR')}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Últimos registros</h2>
          <div className="mt-6 space-y-3">
            {payments.slice(0, 6).map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
                <span>Pagamento registrado</span>
                <span>R$ {Number(payment.amount).toFixed(2)}</span>
                <span>{new Date(payment.paidAt).toLocaleDateString('pt-BR')}</span>
                <span>{payment.method}</span>
              </div>
            ))}
            {invoices.slice(0, 6).map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
                <span>Cobrança {invoice.number}</span>
                <span>R$ {Number(invoice.amount).toFixed(2)}</span>
                <span>{new Date(invoice.dueDate).toLocaleDateString('pt-BR')}</span>
                <span>{invoice.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
