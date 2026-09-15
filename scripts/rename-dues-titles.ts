/**
 * Renomeia o título das Account importadas do backup Cenize com título
 * genérico "Financeiro:Mensalidade" (606 linhas na amm139) para algo legível
 * por linha, tipo "Mensalidade — Junho/2025" — o nome do membro já aparece
 * embaixo na lista de Contas, então não repete aqui.
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/rename-dues-titles.ts <lodgeId>
 *
 * Para gravar de verdade:
 *   node --env-file=.env --import ./test/setup.mjs scripts/rename-dues-titles.ts <lodgeId> \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 */
import { prismaAdmin } from '../src/lib/prisma';

const OLD_TITLE = 'Financeiro:Mensalidade';
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

async function main() {
  const argv = process.argv;
  const lodgeId = argv[2];
  const yes = argv.includes('--yes');
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;

  if (!lodgeId) {
    console.error('Uso: rename-dues-titles.ts <lodgeId> [--confirm-host <trecho>] [--yes]');
    process.exitCode = 1;
    return;
  }

  const rows = await prismaAdmin.account.findMany({
    where: { lodgeId, title: OLD_TITLE },
    select: { id: true, dueDate: true },
  });

  console.log(`Contas com título "${OLD_TITLE}": ${rows.length}`);

  const byMonth = new Map<string, number>();
  for (const r of rows) {
    const key = `${MESES[r.dueDate.getMonth()]}/${r.dueDate.getFullYear()}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  console.log('\nDistribuição por mês:');
  for (const [k, v] of byMonth) console.log(`  ${k}: ${v}`);

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

  let updated = 0;
  for (const r of rows) {
    const newTitle = `Mensalidade — ${MESES[r.dueDate.getMonth()]}/${r.dueDate.getFullYear()}`;
    await prismaAdmin.account.update({ where: { id: r.id }, data: { title: newTitle } });
    updated++;
  }

  console.log(`\nConcluído: ${updated} conta(s) renomeada(s).`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
