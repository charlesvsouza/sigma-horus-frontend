/**
 * SOMENTE LEITURA, todas as lojas. Lista os fechamentos de caixa (CashClose) e compara o saldo gravado com o
 * recalculado do jeito certo (entradas − saídas pelos pagamentos do período), para dimensionar o erro do
 * POST /api/cash-close (que fazia: todos os pagamentos − todas as contas a pagar do período).
 * Uso (PowerShell: Remove-Item Env:DATABASE_URL, Env:APP_DATABASE_URL antes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/inspect-cash-closes.ts
 */
import { prismaAdmin } from '../src/lib/prisma';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const closes = await prismaAdmin.cashClose.findMany({
    orderBy: { closedAt: 'asc' },
    include: { lodge: { select: { name: true, slug: true } }, term: { select: { id: true, title: true, startDate: true, endDate: true, status: true, openingBalance: true } } },
  });
  console.log(`Fechamentos de caixa: ${closes.length}`);
  for (const c of closes) {
    const from = c.term.startDate;
    const to = c.term.endDate ?? c.closedAt;
    const [accounts, payments] = await Promise.all([
      prismaAdmin.account.findMany({ where: { lodgeId: c.lodgeId, dueDate: { gte: from, lte: to } }, select: { amount: true, type: true } }),
      prismaAdmin.payment.findMany({ where: { lodgeId: c.lodgeId, paidAt: { gte: from, lte: to } }, select: { amount: true, account: { select: { type: true } } } }),
    ]);
    const cashIn = r2(payments.filter((p) => p.account?.type === 'RECEIVABLE').reduce((s, p) => s + Number(p.amount), 0));
    const cashOut = r2(payments.filter((p) => p.account?.type === 'PAYABLE').reduce((s, p) => s + Number(p.amount), 0));
    const unlinked = r2(payments.filter((p) => !p.account?.type).reduce((s, p) => s + Number(p.amount), 0));
    const payablesDue = r2(accounts.filter((a) => a.type === 'PAYABLE').reduce((s, a) => s + Number(a.amount), 0));
    const correctNet = r2(cashIn - cashOut);
    const correctClosing = r2(c.openingBalance + correctNet);
    console.log('\n----------------------------------------------');
    console.log(`${c.lodge.slug} | ${c.lodge.name} | período "${c.term.title}" (${c.term.status}) ${from.toISOString().slice(0, 10)} → ${c.term.endDate?.toISOString().slice(0, 10) ?? 'em curso'}`);
    console.log(`fechado em ${c.closedAt.toISOString().slice(0, 10)} | aprovado: ${c.approved ? `sim (${c.approvedAt?.toISOString().slice(0, 10)})` : 'não'}`);
    console.log(`gravado:    abertura ${brl(c.openingBalance)} | pagamentos ${brl(c.totalPayments)} | a pagar ${brl(c.totalPayables)} | líquido ${brl(c.netBalance)} | FINAL ${brl(c.closingBalance)}`);
    console.log(`recalculado: entradas ${brl(cashIn)} | saídas ${brl(cashOut)} | sem conta ${brl(unlinked)} | contas a pagar no período ${brl(payablesDue)} | líquido ${brl(correctNet)} | FINAL ${brl(correctClosing)}`);
    console.log(`DIFERENÇA no saldo final: ${brl(r2(c.closingBalance - correctClosing))}`);
  }
  // Veneralatos abertos com saldo herdado: de onde veio?
  const terms = await prismaAdmin.term.findMany({ orderBy: { startDate: 'asc' }, select: { lodgeId: true, title: true, status: true, openingBalance: true, lodge: { select: { slug: true } } } });
  console.log('\n=== Veneralatos (saldo herdado)');
  for (const t of terms) console.log(`${t.lodge.slug} | ${t.title} | ${t.status} | abertura ${brl(t.openingBalance)}`);
  await prismaAdmin.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
