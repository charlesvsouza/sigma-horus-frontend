import Link from 'next/link';
import { auth } from '@/lib/auth';
import { withTenant } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { FiltrosRelatorios } from '../filtros';
import { BotaoExportar } from '../exportar';
import { INVOICE_STATUS_LABEL } from '@/lib/status-labels';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';

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
          <h1 className="font-display text-2xl font-bold text-sand-light">Resumo financeiro</h1>
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

  // Somas e contagens no banco (não traz todas as linhas para o servidor: com 30 mil lançamentos eram 10 s) —
  // os números são os mesmos de antes; só as 6 linhas de "Próximos vencimentos" e de "Últimos registros" são lidas.
  const openWhere = { ...accountWhere, status: { not: 'paid' } } satisfies Prisma.AccountWhereInput;
  const [totalsByType, openByType, upcomingRows, paymentTotal, payments, invoices] = await withTenant(String(lodgeId), (db) =>
    Promise.all([
      db.account.groupBy({ by: ['type'], where: accountWhere, _sum: { amount: true } }),
      db.account.groupBy({ by: ['type'], where: openWhere, _count: { _all: true } }),
      db.account.findMany({ where: openWhere, select: { id: true, title: true, type: true, dueDate: true }, orderBy: { dueDate: 'asc' }, take: 6 }),
      db.payment.aggregate({ where: paymentWhere, _sum: { amount: true } }),
      db.payment.findMany({ where: paymentWhere, select: { id: true, amount: true, paidAt: true, method: true }, orderBy: { paidAt: 'desc' }, take: 6 }),
      db.invoice.findMany({ where: invoiceWhere, select: { id: true, number: true, amount: true, dueDate: true, status: true }, orderBy: { dueDate: 'asc' }, take: 6 }),
    ]),
  );

  const sumOf = (type: string) => Number(totalsByType.find((t) => t.type === type)?._sum.amount ?? 0);
  const countOf = (type: string) => openByType.find((t) => t.type === type)?._count._all ?? 0;
  const totalReceivables = sumOf('RECEIVABLE');
  const totalPayables = sumOf('PAYABLE');
  const openReceivables = { length: countOf('RECEIVABLE') };
  const openPayables = { length: countOf('PAYABLE') };
  const totalPayments = Number(paymentTotal._sum.amount ?? 0);
  const netFlow = totalPayments - totalPayables;
  const upcoming = upcomingRows;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-sand-light">Resumo financeiro</h1>
            <p className="mt-1 text-sm text-sand-dark">Extrato resumido, contas abertas e fluxo de caixa do período.</p>
          </div>
          <BotaoExportar from={searchParams.from} to={searchParams.to} />
        </div>

        <FiltrosRelatorios from={searchParams.from ?? ''} to={searchParams.to ?? ''} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">A receber</p>
            <p className="mt-3 text-2xl font-semibold text-emerald-300">{brl(totalReceivables)}</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">A pagar</p>
            <p className="mt-3 text-2xl font-semibold text-rose-300">{brl(totalPayables)}</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Pagamentos registrados</p>
            <p className="mt-3 text-2xl font-semibold text-gold">{brl(totalPayments)}</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-sigma-card p-5">
            <p className="text-sm text-sand-dark">Fluxo líquido</p>
            <p className={`mt-3 text-2xl font-semibold ${netFlow >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{brl(netFlow)}</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-sand-light">Resumo de abertura</h2>
              <Link href="/dashboard/contas" className="text-sm text-gold hover:text-gold-light">Ver contas</Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                <p className="text-sm text-sand-dark">Contas a receber abertas</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-300">{openReceivables.length}</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-4">
                <p className="text-sm text-sand-dark">Contas a pagar abertas</p>
                <p className="mt-2 text-2xl font-semibold text-rose-300">{openPayables.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/6 bg-sigma-card p-6">
            <h2 className="text-base font-semibold text-sand-light">Próximos vencimentos</h2>
            <div className="mt-5 space-y-3">
              {upcoming.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/5 bg-sigma-blue-deep/50 p-3 text-sm text-sand">
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.title}</span>
                    <span className={item.type === 'RECEIVABLE' ? 'text-emerald-300' : 'text-rose-300'}>{item.type === 'RECEIVABLE' ? 'Receber' : 'Pagar'}</span>
                  </div>
                  <p className="mt-1 text-xs text-sand-dark">Vence em {formatDateOnly(item.dueDate)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/6 bg-sigma-card p-6">
          <h2 className="text-base font-semibold text-sand-light">Últimos registros</h2>
          <div className="mt-5 space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                <span>Pagamento registrado</span>
                <span>{brl(payment.amount)}</span>
                <span>{new Date(payment.paidAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                <span>{payment.method}</span>
              </div>
            ))}
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-sigma-blue-deep/50 px-4 py-4 text-sm text-sand">
                <span>Cobrança {invoice.number}</span>
                <span>{brl(invoice.amount)}</span>
                <span>{formatDateOnly(invoice.dueDate)}</span>
                <span>{INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
