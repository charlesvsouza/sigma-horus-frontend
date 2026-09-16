/**
 * Backfill de RolePermission: lojas que já customizaram a matriz de
 * Permissões (têm pelo menos uma linha em RolePermission) ficam com o
 * cross-product role×resource×action "congelado" na época em que salvaram —
 * um Resource novo (ex.: 'materials', adicionado nesta sessão, ou o novo
 * 'documents' read para member/hospitaller) nunca aparece pra elas sozinho,
 * porque loadLodgePolicy só cai no DEFAULT_POLICY quando a loja NÃO tem
 * nenhuma linha (ver lib/rbac.ts). Sem este backfill, o Admin de uma loja
 * que já mexeu em Permissões ficaria sem acesso a /dashboard/materiais até
 * reabrir e salvar a tela de novo.
 *
 * Preenche só o que falta (compara contra defaultPermissionRows(), o mesmo
 * cross-product completo usado pra popular a tela) — nunca sobrescreve uma
 * linha que a loja já tem (não mexe em customização existente).
 *
 * Uso (sempre rode primeiro em modo simulação, sem --yes):
 *   node --env-file=.env --import ./test/setup.mjs scripts/backfill-role-permissions.ts
 *
 * Para gravar de verdade:
 *   node --env-file=.env --import ./test/setup.mjs scripts/backfill-role-permissions.ts \
 *     --confirm-host <trecho-do-host-do-DATABASE_URL> --yes
 */
import { prismaAdmin } from '../src/lib/prisma';
import { defaultPermissionRows } from '../src/lib/rbac';

async function main() {
  const argv = process.argv;
  const yes = argv.includes('--yes');
  const hostFlagIndex = argv.indexOf('--confirm-host');
  const confirmHost = hostFlagIndex !== -1 ? argv[hostFlagIndex + 1] : null;

  const lodgesWithCustom = await prismaAdmin.rolePermission.findMany({
    select: { lodgeId: true },
    distinct: ['lodgeId'],
  });

  console.log(`Lojas com Permissões customizadas: ${lodgesWithCustom.length}`);
  if (lodgesWithCustom.length === 0) {
    console.log('Nada a fazer — nenhuma loja customizou a matriz ainda (todas usam DEFAULT_POLICY em runtime).');
    return;
  }

  const fullDefault = defaultPermissionRows();
  let totalMissing = 0;
  const plan: { lodgeId: string; missing: typeof fullDefault }[] = [];

  for (const { lodgeId } of lodgesWithCustom) {
    const existing = await prismaAdmin.rolePermission.findMany({
      where: { lodgeId },
      select: { role: true, resource: true, action: true },
    });
    const have = new Set(existing.map((r) => `${r.role}:${r.resource}:${r.action}`));
    const missing = fullDefault.filter((r) => !have.has(`${r.role}:${r.resource}:${r.action}`));
    if (missing.length > 0) {
      plan.push({ lodgeId, missing });
      totalMissing += missing.length;
      console.log(`  - ${lodgeId}: ${missing.length} linha(s) faltando (${[...new Set(missing.map((m) => m.resource))].join(', ')})`);
    }
  }

  console.log(`\nTotal de linhas a inserir: ${totalMissing}`);

  if (!yes) {
    console.log('\n[SIMULAÇÃO] Nada foi gravado.');
    console.log('Rode de novo com --confirm-host <trecho> --yes para gravar de verdade.');
    return;
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!confirmHost || !dbUrl.includes(confirmHost)) {
    console.error('\n[RECUSADO] --confirm-host não bate com o DATABASE_URL atual.');
    process.exitCode = 1;
    return;
  }

  let inserted = 0;
  for (const { lodgeId, missing } of plan) {
    for (const row of missing) {
      await prismaAdmin.rolePermission.create({
        data: { lodgeId, role: row.role, resource: row.resource, action: row.action, allowed: row.allowed },
      });
      inserted++;
    }
  }

  console.log(`\nConcluído: ${inserted} linha(s) inserida(s) em ${plan.length} loja(s).`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
