/**
 * Zera os lançamentos financeiros da loja amm139 (Loja Antônio Monteiro
 * Martins 139) para o tesoureiro recomeçar o livro caixa manualmente do
 * zero — SÓ POR LINHA DE COMANDO. Não altera a estrutura do banco (nenhuma
 * migration), só apaga linhas.
 *
 * Apaga (escopo combinado com o usuário em 2026-09-15):
 *   - Account (contas a pagar/receber)  → cascata: Payment, Invoice
 *   - BankTransaction (extrato bancário importado)
 *   - Counterparty (cadastro de clientes/fornecedores)
 *
 * NÃO apaga (mantido de propósito):
 *   - Member/Relative (cadastro de obreiros — intocado)
 *   - ChartAccount (plano de contas — é estrutura, não lançamento)
 *   - Tudo mais (Session, Document, User, etc.)
 *
 * Antes de gravar de verdade, roda um backup completo da plataforma
 * (runFullBackup — todas as lojas, criptografado, sobe pro R2) como rede de
 * segurança, e registra um AuditLog do próprio wipe.
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/wipe-amm-financials.ts
 *
 * Depois de conferir as contagens, para apagar de verdade:
 *   node --env-file=.env --import ./test/setup.mjs scripts/wipe-amm-financials.ts \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 */
import { prismaAdmin } from '../src/lib/prisma';
import { runFullBackup } from '../src/lib/backup';

const LODGE_ID = 'cmte81osx000104l1d7cfhg5y'; // amm139

function parseArgs(argv: string[]) {
  const yes = argv.includes('--yes');
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;
  return { yes, confirmHost };
}

async function main() {
  const { yes, confirmHost } = parseArgs(process.argv);

  const [accountCount, paymentCount, invoiceCount, bankTxnCount, counterpartyCount, memberCount, chartAccountCount] = await Promise.all([
    prismaAdmin.account.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.payment.count({ where: { account: { lodgeId: LODGE_ID } } }),
    prismaAdmin.invoice.count({ where: { account: { lodgeId: LODGE_ID } } }),
    prismaAdmin.bankTransaction.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.counterparty.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.member.count({ where: { lodgeId: LODGE_ID } }),
    prismaAdmin.chartAccount.count({ where: { lodgeId: LODGE_ID } }),
  ]);

  console.log('Loja: amm139 (Loja Antônio Monteiro Martins 139)');
  console.log('\nSERÁ APAGADO:');
  console.log(`  Account (contas a pagar/receber): ${accountCount}`);
  console.log(`  Payment (baixas, via cascata de Account): ${paymentCount}`);
  console.log(`  Invoice (via cascata de Account): ${invoiceCount}`);
  console.log(`  BankTransaction (extrato bancário): ${bankTxnCount}`);
  console.log(`  Counterparty (clientes/fornecedores): ${counterpartyCount}`);
  console.log('\nNÃO SERÁ TOCADO:');
  console.log(`  Member (obreiros): ${memberCount}`);
  console.log(`  ChartAccount (plano de contas): ${chartAccountCount}`);

  if (!yes) {
    console.log('\n[SIMULAÇÃO] Nada foi apagado. Rode de novo com --confirm-host <trecho> --yes para apagar de verdade.');
    return;
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!confirmHost || !dbUrl.includes(confirmHost)) {
    console.error('\n--confirm-host ausente ou não bate com o DATABASE_URL atual. Operação recusada por segurança.');
    process.exitCode = 1;
    return;
  }

  console.log('\n📦 Rodando backup completo da plataforma antes de apagar qualquer coisa...');
  const backup = await runFullBackup();
  if (!backup.ok) {
    console.error(`\n✖ Backup falhou (${backup.error}) — operação abortada por segurança. Nada foi apagado.`);
    process.exitCode = 1;
    return;
  }
  console.log(`✔ Backup gravado: ${backup.storageKey} (${backup.totalRows} linhas, ${backup.sizeBytes} bytes).`);

  console.log('\n⚠️  APAGANDO DE VERDADE — iniciando em 5s (Ctrl+C para cancelar)...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const result = await prismaAdmin.$transaction(async (tx) => {
    // Payment/Invoice cascateiam pela FK onDelete:Cascade ao apagar Account.
    const deletedAccounts = await tx.account.deleteMany({ where: { lodgeId: LODGE_ID } });
    const deletedBankTxns = await tx.bankTransaction.deleteMany({ where: { lodgeId: LODGE_ID } });
    const deletedCounterparties = await tx.counterparty.deleteMany({ where: { lodgeId: LODGE_ID } });

    await tx.auditLog.create({
      data: {
        lodgeId: LODGE_ID,
        userId: null, // executado via script de linha de comando, sem usuário logado
        action: 'DELETE',
        entity: 'BulkWipe',
        entityId: LODGE_ID,
        after: JSON.stringify({
          via: 'system-script:wipe-amm-financials',
          reason: 'Tesoureiro vai lançar o livro caixa manualmente — limpeza dos dados migrados do Cenize.',
          deletedAccounts: deletedAccounts.count,
          deletedBankTransactions: deletedBankTxns.count,
          deletedCounterparties: deletedCounterparties.count,
          preWipeBackupKey: backup.storageKey,
          keptChartAccounts: chartAccountCount,
          keptMembers: memberCount,
        }),
      },
    });

    return { deletedAccounts: deletedAccounts.count, deletedBankTxns: deletedBankTxns.count, deletedCounterparties: deletedCounterparties.count };
  });

  console.log('\n✔ Concluído:');
  console.log(`  Account apagadas: ${result.deletedAccounts}`);
  console.log(`  BankTransaction apagadas: ${result.deletedBankTxns}`);
  console.log(`  Counterparty apagadas: ${result.deletedCounterparties}`);
  console.log(`\nBackup de segurança pré-wipe: ${backup.storageKey}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
