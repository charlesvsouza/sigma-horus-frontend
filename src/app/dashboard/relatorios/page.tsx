import Link from 'next/link';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { FiltrosRelatorios } from './filtros';
import { BotaoExportar } from './exportar';

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function RelatoriosPage(props: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await auth();
  const lodgeId = session?.user?.lodgeId;

  const searchParams = await props.searchParams;
  const fromDate = parseDate(searchParams.from);
  const toDate = parseDate(searchParams.to);

  if (!lodgeId) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-2xl font-bold text-sand-light">Relatórios</h1>
          <p className="mt-1 text-sm text-sand-dark">Faça login para ver o fluxo financeiro da lodge.</p>
        </div>
      </main>
    );
  }

  const accountWhere: Prisma.AccountWhereInput = { lodgeId: String(lodgeId) };
  const invoiceWhere: Prisma.InvoiceWhereInput = { lodgeId: String(lodgeId) };
  const paymentWhere: Prisma.PaymentWhereInput = { lodgeId: String(lodgeId) };

  if (fromDate || toDate) {
    const range: Prisma.DateTimeFilter = {};
    if (fromDate) range.gte = fromDate;
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    accountWhere.dueDate = range;
    invoiceWhere.dueDate = range;
    paymentWhere.paidAt = range;
  }

  const [accounts, invoices, payments] = await withTenant(String(lodgeId), (db) =>
    Promise.all([
      db.account.findMany({
        where: accountWhere,
        select: { id: true, title: true, type: true, amount: true, dueDate: true, status: true },
        orderBy: { dueDate: 'asc' },
      }),
      db.invoice.findMany({
        where: invoiceWhere,
        select: { id: true, number: true, amount: true, dueDate: true, status: true },
        orderBy: { dueDate: 'asc' },
      }),
      db.payment.findMany({
        where: paymentWhere,
        select: { id: true, amount: true, paidAt: true, method: true },
        orderBy: { paidAt: 'desc' },
      }),
    ]),
  );

  const receivables = accounts.filter((a) => a.type === 'RECEIVABLE');
  const payables = accounts.filter((a) => a.type === 'PAYABLE');
  const openReceivables = receivables.filter((a) => a.status !== 'paid');
  const openPayables = payables.filter((a) => a.status !== 'paid');
  const totalReceivables = receivables.reduce((s, a) => s + Number(a.amount ?? 0), 0);
  const totalPayables = payables.reduce((s, a) => s + Number(a.amount ?? 0), 0);
  const totalPayments = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const netFlow = totalPayments - totalPayables;

  const upcoming = ([...receivables, ...payables] as Array<{ id: string; title: string; type: string; dueDate: string | Date }>)
    .filter((item) => !accounts.find((a) => a.id === item.id) || (accounts.find((a) => a.id === item.id)?.status !== 'paid'))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 6);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Relatórios financeiros</h1>
            <p className="mt-1 text-sm text-sand-dark">Extrato resumido, contas abertas e fluxo de caixa do período.</p>
          </div>
          <BotaoExportar from={searchParams.from} to={searchParams.to} />
        </div>

        <FiltrosRelatorios from={searchParams.from ?? ''} to={searchParams.to ?? ''} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">A receber</p>
            <p className="mt-3 text-2xl font-semibold text-emerald-300">R$ {totalReceivables.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">A pagar</p>
            <p className="mt-3 text-2xl font-semibold text-rose-300">R$ {totalPayables.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Pagamentos registrados</p>
            <p className="mt-3 text-2xl font-semibold text-gold">R$ {totalPayments.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Fluxo líquido</p>
            <p className={`mt-3 text-2xl font-semibold ${netFlow >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>R$ {netFlow.toFixed(2)}</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-sand-light">Resumo de abertura</h2>
              <Link href="/dashboard/contas" className="text-sm text-gold hover:text-gold-light">Ver contas</Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                <p className="text-sm text-sand-dark">Contas a receber abertas</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-300">{openReceivables.length}</p>
              </div>
              <div className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-4">
                <p className="text-sm text-sand-dark">Contas a pagar abertas</p>
                <p className="mt-2 text-2xl font-semibold text-rose-300">{openPayables.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Próximos vencimentos</h2>
            <div className="mt-5 space-y-3">
              {upcoming.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 p-3 text-sm text-sand">
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.title}</span>
                    <span className={item.type === 'RECEIVABLE' ? 'text-emerald-300' : 'text-rose-300'}>{item.type === 'RECEIVABLE' ? 'Receber' : 'Pagar'}</span>
                  </div>
                  <p className="mt-1 text-xs text-sand-dark">Vence em {new Date(item.dueDate).toLocaleDateString('pt-BR')}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/[6%] bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Últimos registros</h2>
          <div className="mt-5 space-y-3">
            {payments.slice(0, 6).map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                <span>Pagamento registrado</span>
                <span>R$ {Number(payment.amount).toFixed(2)}</span>
                <span>{new Date(payment.paidAt).toLocaleDateString('pt-BR')}</span>
                <span>{payment.method}</span>
              </div>
            ))}
            {invoices.slice(0, 6).map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[5%] bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
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
