/**
 * Auditoria SOMENTE LEITURA dos campos de dinheiro (Float): existe algum valor com mais de
 * 2 casas decimais, NaN/Infinity ou grande demais para numeric(14,2)?
 *
 * Nada é gravado: tudo roda dentro de uma transação READ ONLY que termina em ROLLBACK.
 * Conecta como DATABASE_URL (superusuário, vê todas as lojas).
 *
 * Uso (na pasta apps/frontend):
 *   PowerShell:
 *     Remove-Item Env:DATABASE_URL, Env:APP_DATABASE_URL -ErrorAction SilentlyContinue
 *     node --env-file=.env scripts/audit-money-decimals.ts
 *   Git Bash:
 *     env -u DATABASE_URL -u APP_DATABASE_URL node --env-file=.env scripts/audit-money-decimals.ts
 *
 * (A variável DATABASE_URL do Windows aponta para localhost e sombreia o .env — por isso a remoção.)
 *
 * Código de saída: 0 = nenhum valor problemático; 2 = achou algum (veja a tabela e os exemplos).
 */
import fs from 'node:fs';
import pg from 'pg';
import { auditColumn, parseFloatColumns, verdict, type ColumnReport } from '../src/lib/money-audit.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida. Rode com --env-file=.env (e remova a variável do Windows, ver topo do arquivo).');
  process.exit(1);
}

const host = new URL(url).host;
console.log(`Banco: ${host}  (somente leitura)`);
if (/^(localhost|127\.0\.0\.1)/.test(host)) {
  console.warn('ATENÇÃO: o host é local. Se você queria auditar produção, a variável DATABASE_URL do Windows está sombreando o .env.');
}

const columns = parseFloatColumns(fs.readFileSync('prisma/schema.prisma', 'utf8'));
const client = new pg.Client({ connectionString: url });
await client.connect();

const reports: ColumnReport[] = [];
try {
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '30s'");
  for (const col of columns) {
    try {
      reports.push(await auditColumn((sql) => client.query(sql), col));
    } catch (error) {
      // Um erro numa coluna aborta a transação; recomeça para as próximas.
      console.error(`Falha em ${col.model}.${col.field}: ${(error as Error).message}`);
      await client.query('ROLLBACK');
      await client.query('BEGIN READ ONLY');
      await client.query("SET LOCAL statement_timeout = '30s'");
    }
  }
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}

console.table(
  reports.map((r) => ({
    campo: `${r.model}.${r.field}`,
    tipo: r.kind === 'percent' ? 'taxa %' : 'dinheiro',
    linhas: r.total,
    preenchidas: r.filled,
    'mais de 2 casas': r.subCent,
    negativos: r.negative,
    'NaN/Inf': r.nonFinite,
    'grande demais': r.tooBig,
    'maior valor': r.maxAbs ?? '-',
  })),
);

const result = verdict(reports);
for (const r of result.dirty) {
  if (r.examples.length) {
    console.log(`\nExemplos em ${r.model}.${r.field}:`);
    for (const e of r.examples) console.log(`  id=${e.id}  valor=${e.value}`);
  }
}
if (result.negativeColumns.length) {
  console.log(`\nAviso: há valores negativos em: ${result.negativeColumns.join(', ')} (pode ser legítimo, ex.: saldo).`);
}

if (result.clean) {
  console.log('\nRESULTADO: nenhum valor de dinheiro com mais de 2 casas, NaN/Infinity ou grande demais.');
  console.log('=> Não há dado ruim hoje. Um CHECK no banco é suficiente; a migração para Decimal não se justifica ainda.');
  process.exit(0);
}
console.log(`\nRESULTADO: ${result.subCentTotal} valor(es) com mais de 2 casas e/ou dados inválidos em ${result.dirty.length} campo(s).`);
console.log('=> Envie esta saída: define por qual tabela começar a corrigir/migrar.');
process.exit(2);
