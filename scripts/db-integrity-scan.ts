/**
 * Varredura de integridade do banco inteiro (todas as lojas) — somente
 * leitura, não altera nada. Usa os metadados reais do Postgres (não o
 * schema.prisma) pra não depender de nada estar sincronizado:
 *
 *   1. Para cada foreign key existente no banco, conta linhas "órfãs"
 *      (FK preenchida apontando pra um registro que não existe mais).
 *   2. Confere se RLS (row-level security) está ligado e forçado em toda
 *      tabela multi-tenant (isolamento entre lojas).
 *
 * Uso:
 *   node --env-file=.env --import ./test/setup.mjs scripts/db-integrity-scan.ts
 */
import { prismaAdmin } from '../src/lib/prisma';

interface FkConstraint {
  constraint_name: string;
  child_table: string;
  child_column: string;
  parent_table: string;
  parent_column: string;
}

async function main() {
  console.log('=== 1. Foreign keys órfãs ===\n');

  const fks = await prismaAdmin.$queryRaw<FkConstraint[]>`
    SELECT
      tc.constraint_name,
      kcu.table_name  AS child_table,
      kcu.column_name AS child_column,
      ccu.table_name  AS parent_table,
      ccu.column_name AS parent_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY kcu.table_name, kcu.column_name;
  `;

  let totalOrphans = 0;
  const problems: { table: string; column: string; references: string; orphans: number }[] = [];

  for (const fk of fks) {
    const sql = `
      SELECT count(*)::int AS n
      FROM "${fk.child_table}" c
      WHERE c."${fk.child_column}" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "${fk.parent_table}" p WHERE p."${fk.parent_column}" = c."${fk.child_column}")
    `;
    const result = await prismaAdmin.$queryRawUnsafe<{ n: number }[]>(sql);
    const n = result[0]?.n ?? 0;
    if (n > 0) {
      totalOrphans += n;
      problems.push({ table: fk.child_table, column: fk.child_column, references: `${fk.parent_table}.${fk.parent_column}`, orphans: n });
    }
  }

  if (problems.length === 0) {
    console.log(`OK — nenhuma linha órfã encontrada em ${fks.length} foreign keys verificadas.`);
  } else {
    console.log(`ATENÇÃO — ${totalOrphans} linha(s) órfã(s) em ${problems.length} relação(ões):`);
    console.table(problems);
  }

  console.log('\n=== 2. Row-Level Security por tabela ===\n');

  const rls = await prismaAdmin.$queryRaw<{ tablename: string; rowsecurity: boolean; forcerowsecurity: boolean }[]>`
    SELECT c.relname AS tablename, c.relrowsecurity AS rowsecurity, c.relforcerowsecurity AS forcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname NOT IN ('_prisma_migrations')
    ORDER BY c.relname;
  `;

  const withoutLodgeCol = new Set(['Lodge', 'Invitation', 'BackupLog']); // tabelas sem lodgeId (plataforma) — RLS não se aplica
  const missingRls = rls.filter((t) => !withoutLodgeCol.has(t.tablename) && (!t.rowsecurity || !t.forcerowsecurity));

  if (missingRls.length === 0) {
    console.log(`OK — RLS ligado e forçado em todas as ${rls.length - withoutLodgeCol.size} tabelas multi-tenant.`);
  } else {
    console.log(`ATENÇÃO — tabelas sem RLS ligado/forçado:`);
    console.table(missingRls);
  }

  console.log('\n=== Resumo ===');
  console.log(problems.length === 0 && missingRls.length === 0 ? '✔ Nenhuma corrupção ou brecha de isolamento encontrada.' : '⚠ Ver detalhes acima.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prismaAdmin.$disconnect());
