/**
 * Inspeção somente-leitura dos dados financeiros de uma loja (por slug).
 * Uso: node --env-file=.env --import ./test/setup.mjs scripts/inspect-lodge-financials.ts <slug>
 */
import { prismaAdmin } from '../src/lib/prisma';

async function main() {
  const slug = process.argv[2];
  const lodges = await prismaAdmin.lodge.findMany({ select: { id: true, name: true, slug: true, status: true } });
  if (!slug) { console.table(lodges); return; }
  const lodge = lodges.find((l) => l.slug === slug);
  if (!lodge) { console.error('slug não encontrado'); console.table(lodges); return; }
  const id = lodge.id;
  console.log(lodge);
  const [members, accByStatus, payments, bank, cps, chart, fin, balancetes] = await Promise.all([
    prismaAdmin.member.count({ where: { lodgeId: id } }),
    prismaAdmin.account.groupBy({ by: ['type', 'status'], where: { lodgeId: id }, _count: true, _sum: { amount: true } }),
    prismaAdmin.payment.count({ where: { lodgeId: id } }),
    prismaAdmin.bankTransaction.count({ where: { lodgeId: id } }),
    prismaAdmin.counterparty.count({ where: { lodgeId: id } }),
    prismaAdmin.chartAccount.count({ where: { lodgeId: id } }),
    prismaAdmin.financialAccount.findMany({ where: { lodgeId: id }, select: { id: true, name: true, kind: true, purpose: true, openingBalance: true } }),
    prismaAdmin.balancete.count({ where: { lodgeId: id } }),
  ]);
  console.log({ members, payments, bank, counterparties: cps, chartAccounts: chart, balancetes });
  console.table(accByStatus.map((r) => ({ type: r.type, status: r.status, n: r._count, sum: r._sum.amount })));
  console.table(fin);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prismaAdmin.$disconnect());
