/**
 * Backfill de Counterparty a partir dos Account.counterpartyName já
 * existentes (texto livre gravado na importação do backup Cenize da loja
 * amm139) — cria um cadastro de verdade e liga Account.counterpartyId.
 * Reaproveitável por qualquer loja que tenha Account.counterpartyName sem
 * counterpartyId ainda.
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/backfill-counterparties.ts <lodgeId>
 *
 * Para gravar de verdade:
 *   node --env-file=.env --import ./test/setup.mjs scripts/backfill-counterparties.ts <lodgeId> \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 */
import { prismaAdmin } from '../src/lib/prisma';

function normalizeKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toUpperCase();
}

async function main() {
  const argv = process.argv;
  const lodgeId = argv[2];
  const yes = argv.includes('--yes');
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;

  if (!lodgeId) {
    console.error('Uso: backfill-counterparties.ts <lodgeId> [--confirm-host <trecho>] [--yes]');
    process.exitCode = 1;
    return;
  }

  const accounts = await prismaAdmin.account.findMany({
    where: { lodgeId, counterpartyName: { not: null }, counterpartyId: null },
    select: { id: true, counterpartyName: true, counterpartyDoc: true, type: true },
  });

  console.log(`Accounts com counterpartyName e sem counterpartyId: ${accounts.length}`);

  type Group = { name: string; document: string | null; accountIds: string[]; hasReceivable: boolean; hasPayable: boolean };
  const groups = new Map<string, Group>();

  for (const a of accounts) {
    const name = (a.counterpartyName ?? '').trim();
    if (!name) continue;
    const key = normalizeKey(name);
    if (!groups.has(key)) {
      groups.set(key, { name, document: a.counterpartyDoc, accountIds: [], hasReceivable: false, hasPayable: false });
    }
    const g = groups.get(key)!;
    g.accountIds.push(a.id);
    if (a.type === 'RECEIVABLE') g.hasReceivable = true;
    if (a.type === 'PAYABLE') g.hasPayable = true;
    if (!g.document && a.counterpartyDoc) g.document = a.counterpartyDoc;
  }

  const existing = await prismaAdmin.counterparty.findMany({ where: { lodgeId }, select: { id: true, name: true } });
  const existingByKey = new Map(existing.map((c) => [normalizeKey(c.name), c]));

  console.log(`\nContrapartes distintas encontradas: ${groups.size} (já cadastradas: ${[...groups.keys()].filter((k) => existingByKey.has(k)).length})`);
  console.log('\n-- Amostra (10 primeiras) --');
  let i = 0;
  for (const g of groups.values()) {
    if (i++ >= 10) break;
    const kind = g.hasReceivable && g.hasPayable ? 'both' : g.hasReceivable ? 'client' : 'supplier';
    console.log(`  "${g.name}" -> kind=${kind}, ${g.accountIds.length} conta(s)${existingByKey.has(normalizeKey(g.name)) ? ' [já existe]' : ''}`);
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

  let createdCount = 0;
  let linkedCount = 0;
  for (const g of groups.values()) {
    const key = normalizeKey(g.name);
    let counterpartyId = existingByKey.get(key)?.id;

    if (!counterpartyId) {
      const kind = g.hasReceivable && g.hasPayable ? 'both' : g.hasReceivable ? 'client' : 'supplier';
      const created = await prismaAdmin.counterparty.create({
        data: { lodgeId, name: g.name, kind, document: g.document || null },
      });
      counterpartyId = created.id;
      createdCount++;
    }

    await prismaAdmin.account.updateMany({
      where: { id: { in: g.accountIds } },
      data: { counterpartyId },
    });
    linkedCount += g.accountIds.length;
  }

  console.log(`\nConcluído: ${createdCount} Counterparty criada(s), ${linkedCount} Account(s) linkada(s).`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
