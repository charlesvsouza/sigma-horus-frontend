/**
 * Corrige a categorização do saldo de abertura da amm139: os saldos que já
 * existiam em conta corrente e no CDB de investimento no início da
 * escrituração tinham sido lançados como "Conta a receber" já paga (porque a
 * tela de Contas bancárias e Caixa não tinha campo de saldo inicial — agora
 * tem, ver CadastrosFinanceirosClient.tsx). Isso inflava o card "A receber"
 * do Resumo financeiro em R$ 134.109,72 com dinheiro que não é "a receber de
 * ninguém" — é só o saldo de abertura das próprias contas.
 *
 * Ação: move os dois valores para FinancialAccount.openingBalance (onde
 * pertencem) e apaga as duas Account fantasmas que os representavam. A
 * terceira conta a receber da mesma leva (Tronco de Beneficência, R$ 40, doação
 * avulsa de verdade) NÃO é tocada.
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/fix-amm-opening-balance.ts
 *
 * Para gravar de verdade:
 *   node --env-file=.env --import ./test/setup.mjs scripts/fix-amm-opening-balance.ts \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 */
import { prismaAdmin } from '../src/lib/prisma';

const LODGE_ID = 'cmte81osx000104l1d7cfhg5y'; // amm139

const PLAN = [
  { accountId: 'cmu4c05m5000904jngnbxkehr', financialAccountName: 'CONTA INVESTIMENTO', amount: 124289.94 },
  { accountId: 'cmu4c1hiv000b04jnvnv5ta44', financialAccountName: 'CONTA CORRENTE', amount: 9819.78 },
] as const;

async function main() {
  const argv = process.argv;
  const yes = argv.includes('--yes');
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;

  for (const item of PLAN) {
    const account = await prismaAdmin.account.findUnique({ where: { id: item.accountId }, select: { id: true, lodgeId: true, title: true, amount: true, payments: { select: { id: true } }, invoices: { select: { id: true } } } });
    if (!account || account.lodgeId !== LODGE_ID) {
      console.error(`[ABORTADO] Account ${item.accountId} não encontrada na loja esperada — nada foi gravado.`);
      process.exitCode = 1;
      return;
    }
    if (Number(account.amount) !== item.amount) {
      console.error(`[ABORTADO] Account ${item.accountId} tem valor ${account.amount}, esperado ${item.amount} — dado mudou desde a análise, revise o script antes de rodar de novo.`);
      process.exitCode = 1;
      return;
    }
    if (account.payments.length > 0 || account.invoices.length > 0) {
      console.error(`[ABORTADO] Account ${item.accountId} tem Payment/Invoice vinculado — não é seguro apagar. Revise manualmente.`);
      process.exitCode = 1;
      return;
    }

    const financialAccount = await prismaAdmin.financialAccount.findFirst({ where: { lodgeId: LODGE_ID, name: item.financialAccountName } });
    if (!financialAccount) {
      console.error(`[ABORTADO] FinancialAccount "${item.financialAccountName}" não encontrada.`);
      process.exitCode = 1;
      return;
    }

    console.log(`- "${account.title}" (Account ${account.id}, R$ ${item.amount.toFixed(2)})`);
    console.log(`    remove a Account e grava FinancialAccount "${item.financialAccountName}" (${financialAccount.id}).openingBalance: ${financialAccount.openingBalance} → ${item.amount.toFixed(2)}`);
  }

  if (!yes) {
    console.log('\n[SIMULAÇÃO] Nada foi gravado. Rode de novo com --confirm-host <trecho> --yes para gravar.');
    return;
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!confirmHost || !dbUrl.includes(confirmHost)) {
    console.error('\n[RECUSADO] --confirm-host não bate com o DATABASE_URL atual.');
    process.exitCode = 1;
    return;
  }

  for (const item of PLAN) {
    const financialAccount = await prismaAdmin.financialAccount.findFirstOrThrow({ where: { lodgeId: LODGE_ID, name: item.financialAccountName } });
    await prismaAdmin.$transaction(async (tx) => {
      await tx.financialAccount.update({ where: { id: financialAccount.id }, data: { openingBalance: item.amount } });
      await tx.account.delete({ where: { id: item.accountId } });
      await tx.auditLog.create({
        data: {
          lodgeId: LODGE_ID,
          userId: null,
          action: 'UPDATE',
          entity: 'financialAccount',
          entityId: financialAccount.id,
          before: JSON.stringify({ openingBalance: financialAccount.openingBalance }),
          after: JSON.stringify({ reason: 'fix-amm-opening-balance-2026-09-18', openingBalance: item.amount, removedAccountId: item.accountId }),
        },
      });
    });
    console.log(`Concluído: "${item.financialAccountName}" atualizada, Account ${item.accountId} removida.`);
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
