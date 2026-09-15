/**
 * Inspeção somente-leitura dos dados financeiros da loja amm139, para
 * decidir com precisão o escopo de uma limpeza (o tesoureiro vai lançar o
 * livro caixa manualmente do zero). NÃO apaga nada.
 *
 * Uso:
 *   node --env-file=.env --import ./test/setup.mjs scripts/inspect-amm-financials.ts
 */
import { prismaAdmin } from '../src/lib/prisma';

const LODGE_ID = 'cmte81osx000104l1d7cfhg5y'; // amm139

async function main() {
  const [
    lodge,
    memberCount,
    accountCount,
    accountByStatus,
    invoiceCount,
    paymentCount,
    bankTxnCount,
    counterpartyCount,
    chartAccountCount,
    cashCloseCount,
    balanceteCount,
    budgetCount,
    campaignCount,
    donationCount,
    messageLogCount,
  ] = await Promise.all([
    prismaAdmin.lodge.findUnique({ where: { id: LODGE_ID }, select: { id: true, name: true, slug: true } }),
    prismaAdmin.member.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.account.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.account.groupBy({ by: ['type', 'status'], where: { lodgeId: LODGE_ID }, _count: true, _sum: { amount: true } }),
    prismaAdmin.invoice.count({ where: { account: { lodgeId: LODGE_ID } } }),
    prismaAdmin.payment.count({ where: { account: { lodgeId: LODGE_ID } } }),
    prismaAdmin.bankTransaction.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.counterparty.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.chartAccount.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.cashClose.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.balancete.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.budget.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.campaign.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.campaignDonation.count({ where: { campaign: { lodgeId: LODGE_ID } } }),
    prismaAdmin.messageLog.count({ where: { lodgeId: LODGE_ID } }),
  ]);

  console.log('Loja:', lodge);
  console.log('Membros (NÃO será tocado):', memberCount);
  console.log('---');
  console.log('Account (contas a pagar/receber) total:', accountCount);
  console.table(accountByStatus.map((r) => ({ type: r.type, status: r.status, count: r._count, sum: r._sum.amount?.toString() })));
  console.log('Invoice (boletos/PIX Asaas):', invoiceCount);
  console.log('Payment (baixas registradas):', paymentCount);
  console.log('BankTransaction (extrato importado):', bankTxnCount);
  console.log('---');
  console.log('Counterparty (clientes/fornecedores cadastrados):', counterpartyCount);
  console.log('ChartAccount (plano de contas):', chartAccountCount);
  console.log('CashClose (fechamentos):', cashCloseCount);
  console.log('Balancete:', balanceteCount);
  console.log('Budget (orçamento):', budgetCount);
  console.log('Campaign (campanhas):', campaignCount);
  console.log('CampaignDonation (doações):', donationCount);
  console.log('MessageLog (histórico de mensagens/cobrança):', messageLogCount);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
