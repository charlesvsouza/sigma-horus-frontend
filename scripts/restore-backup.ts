/**
 * Restauração do backup completo da plataforma — SÓ POR LINHA DE COMANDO.
 * Nunca exponha isso como rota web: escreve em todas as tabelas de todas as
 * lojas, sem RLS (prismaAdmin), na ordem que respeita as foreign keys.
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/restore-backup.ts <storageKey>
 *
 * Depois de conferir a contagem por tabela, para restaurar de verdade:
 *   node --env-file=.env --import ./test/setup.mjs scripts/restore-backup.ts <storageKey> \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 *
 * --confirm-host é uma trava manual: você digita um pedaço do host do banco
 * (ex.: "kodama.proxy.rlwy.net") pra confirmar que sabe exatamente em qual
 * banco está gravando. Sem bater com o DATABASE_URL atual, o script recusa.
 *
 * Ver AGENTS.md para o runbook completo (quando usar, o que esperar, como
 * validar depois).
 */
import { BACKUP_MODELS, decodeBackupBlob, restoreModelRows } from '../src/lib/backup';
import { getObjectBuffer } from '../src/lib/storage';

function parseArgs(argv: string[]) {
  const storageKey = argv[2];
  const yes = argv.includes('--yes');
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;
  return { storageKey, yes, confirmHost };
}

async function main() {
  const { storageKey, yes, confirmHost } = parseArgs(process.argv);

  if (!storageKey) {
    console.error('Uso: restore-backup.ts <storageKey> [--confirm-host <trecho>] [--yes]');
    console.error('Veja o histórico de storageKeys em /plataforma/backups.');
    process.exitCode = 1;
    return;
  }

  console.log(`Baixando backup: ${storageKey}`);
  const blob = await getObjectBuffer(storageKey);
  if (!blob) {
    console.error('Backup não encontrado no storage (ou R2 não configurado).');
    process.exitCode = 1;
    return;
  }

  const manifest = decodeBackupBlob(blob);
  console.log(`Backup de ${manifest.createdAt} (versão ${manifest.version}).`);

  const counts = BACKUP_MODELS.map((m) => ({ model: m, rows: manifest.models[m]?.length ?? 0 }));
  console.table(counts);
  const totalRows = counts.reduce((sum, c) => sum + c.rows, 0);
  console.log(`Total: ${totalRows} registro(s) em ${BACKUP_MODELS.length} tabelas.`);

  if (!yes) {
    console.log('\n[SIMULAÇÃO] Nada foi gravado. Rode de novo com --confirm-host <trecho> --yes para restaurar de verdade.');
    return;
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!confirmHost || !dbUrl.includes(confirmHost)) {
    console.error('\n--confirm-host ausente ou não bate com o DATABASE_URL atual. Restauração recusada por segurança.');
    process.exitCode = 1;
    return;
  }

  console.log('\n⚠️  GRAVANDO DE VERDADE — isso pode sobrescrever dados existentes. Iniciando em 5s (Ctrl+C para cancelar)...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const report: { model: string; created: number; error?: string }[] = [];
  for (const model of BACKUP_MODELS) {
    const rows = manifest.models[model] ?? [];
    try {
      const created = await restoreModelRows(model, rows);
      report.push({ model, created });
      console.log(`✔ ${model}: ${created}/${rows.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      report.push({ model, created: 0, error: message });
      console.error(`✘ ${model}: falhou — ${message}`);
    }
  }

  console.log('\nRestauração concluída. Resumo:');
  console.table(report);
  console.log('\nConfira alguns registros manualmente (datas, valores) antes de liberar o sistema.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
