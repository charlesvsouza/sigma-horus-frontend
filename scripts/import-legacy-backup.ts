/**
 * Importa o backup financeiro de um sistema legado (pasta com os relatórios em
 * CSV/XLSX) para UMA loja — mesma lógica da tela "Importar backup financeiro"
 * (src/lib/legacy-import), só que por linha de comando, para migrações
 * assistidas e para conferir o resultado antes de gravar.
 *
 * Modos (sempre começa em simulação; nada é gravado sem --yes):
 *   --offline                     não acessa o banco (plano de contas padrão, sem membros) — só confere os arquivos
 *   --export-aligned <arquivo>    grava um .xlsx com os dados JÁ ALINHADOS (lançamentos, clientes, fornecedores, contas em aberto, balancete)
 *   --member-matching exact|fuzzy|none   (padrão exact)
 *   --yes --confirm-host <trecho do host do DATABASE_URL>   grava de verdade
 *   --allow-repeat                permite importar de novo numa loja que já tem lote
 *   --undo <lote>                 remove o que o lote criou
 *
 * Uso:
 *   node --env-file=.env --import ./test/setup.mjs scripts/import-legacy-backup.ts <slug-da-loja> <pasta> [modos]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { prismaAdmin } from '../src/lib/prisma';
import { MASONIC_CHART_OF_ACCOUNTS } from '../src/lib/masonic-reference';
import { readLegacyFiles, KIND_LABEL } from '../src/lib/legacy-import/service';
import { buildPlan, DEFAULT_PLAN_OPTIONS, type ImportPlan, type PlanContext, type PlanOptions } from '../src/lib/legacy-import/planner';
import { commitPlan, findLegacyBatches, undoLegacyBatch } from '../src/lib/legacy-import/commit';
import type { LegacyFiles } from '../src/lib/legacy-import/planner';
import { refuseIfProtected } from './protected-lodges';

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(n);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !['--confirm-host', '--export-aligned', '--member-matching', '--undo'].includes(argv[i - 1] ?? ''));
const [slug, dir] = positional;

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function exportAligned(file: string, plan: ImportPlan, files: LegacyFiles) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const add = (name: string, cols: { header: string; key: string; width: number; fmt?: string }[], rows: Record<string, unknown>[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.fmt ? { numFmt: c.fmt } : undefined }));
    ws.getRow(1).font = { bold: true };
    ws.addRows(rows);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  };
  const BRL = '#,##0.00;[Red]-#,##0.00';
  const dt = (iso: string) => new Date(`${iso}T00:00:00Z`);
  add('Lançamentos', [
    { header: 'Data', key: 'date', width: 12, fmt: 'dd/mm/yyyy' }, { header: 'Conta', key: 'account', width: 22 },
    { header: 'Entrada/Saída', key: 'type', width: 14 }, { header: 'Valor', key: 'amount', width: 14, fmt: BRL },
    { header: 'Contraparte', key: 'name', width: 34 }, { header: 'Categoria (sistema antigo)', key: 'cat', width: 38 },
    { header: 'Código no Sigma Horus', key: 'code', width: 14 }, { header: 'Descrição', key: 'desc', width: 60 },
  ], [...plan.transactions].sort((a, b) => a.date.localeCompare(b.date) || a.account.localeCompare(b.account)).map((t) => ({ date: dt(t.date), account: t.account, type: t.type === 'RECEIVABLE' ? 'Entrada' : 'Saída', amount: t.type === 'RECEIVABLE' ? t.amount : -t.amount, name: t.name, cat: t.categoryKey ?? '', code: t.chartCode ?? '', desc: t.description })));
  add('Transferências', [
    { header: 'Data', key: 'date', width: 12, fmt: 'dd/mm/yyyy' }, { header: 'De', key: 'from', width: 22 }, { header: 'Para', key: 'to', width: 22 }, { header: 'Valor', key: 'amount', width: 14, fmt: BRL },
  ], plan.transfers.map((t) => ({ date: dt(t.date), from: t.from, to: t.to, amount: t.amount })));
  add('Contas em aberto', [
    { header: 'Vencimento', key: 'due', width: 12, fmt: 'dd/mm/yyyy' }, { header: 'Nome', key: 'name', width: 38 }, { header: 'Valor', key: 'amount', width: 14, fmt: BRL }, { header: 'Situação no relatório', key: 'desc', width: 60 },
  ], plan.openItems.map((i) => ({ due: dt(i.dueDate), name: i.name, amount: i.amount, desc: i.description })));
  add('Clientes e fornecedores', [
    { header: 'Nome', key: 'name', width: 40 }, { header: 'Tipo', key: 'kind', width: 12 }, { header: 'CPF/CNPJ', key: 'doc', width: 20 }, { header: 'Telefone', key: 'phone', width: 18 }, { header: 'Cidade', key: 'city', width: 20 }, { header: 'UF', key: 'uf', width: 6 }, { header: 'Observação', key: 'notes', width: 50 },
  ], plan.counterparties.map((c) => ({ name: c.name, kind: c.kind === 'client' ? 'Cliente' : c.kind === 'supplier' ? 'Fornecedor' : 'Ambos', doc: c.document ?? '', phone: c.phone ?? '', city: c.city ?? '', uf: c.state ?? '', notes: c.notes ?? '' })));
  if (plan.balancete) {
    add('Balancete', [
      { header: 'Conta do plano', key: 'name', width: 46 }, { header: 'Nível', key: 'level', width: 8 }, { header: 'Saldo inicial', key: 'opening', width: 14, fmt: BRL },
      { header: 'Débitos', key: 'debit', width: 14, fmt: BRL }, { header: 'Créditos', key: 'credit', width: 14, fmt: BRL }, { header: 'Saldo atual', key: 'closing', width: 14, fmt: BRL },
    ], plan.balancete.lines.map((l) => ({ name: `${'    '.repeat(l.level)}${l.path[l.path.length - 1]}`, level: l.level, opening: l.opening, debit: l.debit, credit: l.credit, closing: l.closing })));
  }
  add('Conferência', [{ header: 'Conferência', key: 'label', width: 40 }, { header: 'Resultado', key: 'ok', width: 10 }, { header: 'Detalhe', key: 'detail', width: 100 }],
    plan.checks.map((c) => ({ label: c.label, ok: c.ok ? 'Confere' : 'DIVERGE', detail: c.detail })));
  if (files.openItems) add('Avisos', [{ header: 'Aviso', key: 'w', width: 140 }], plan.warnings.map((w) => ({ w })));
  await wb.xlsx.writeFile(file);
}

async function main() {
  if (!dir && !opt('--undo')) {
    console.error('Uso: import-legacy-backup.ts <slug-da-loja|-> <pasta> [--offline] [--export-aligned arquivo.xlsx] [--yes --confirm-host <trecho>] [--undo <lote>]');
    process.exitCode = 1;
    return;
  }
  const offline = flag('--offline');
  const refusal = flag('--yes') ? refuseIfProtected(slug, argv) : null;
  if (refusal) { console.error(refusal); process.exitCode = 1; return; }

  let lodge: { id: string; name: string; slug: string } | null = null;
  if (!offline) {
    lodge = await prismaAdmin.lodge.findFirst({ where: { slug }, select: { id: true, name: true, slug: true } });
    if (!lodge) { console.error(`Loja "${slug}" não encontrada.`); process.exitCode = 1; return; }
    console.log(`Loja: ${lodge.name} (${lodge.slug}) [${lodge.id}]`);
  }

  const undo = opt('--undo');
  if (undo) {
    if (!lodge) { console.error('--undo precisa de acesso ao banco.'); process.exitCode = 1; return; }
    if (!flag('--yes') || !(process.env.DATABASE_URL ?? '').includes(opt('--confirm-host') ?? '\0')) { console.error('Para desfazer: --yes --confirm-host <trecho do host>.'); process.exitCode = 1; return; }
    const res = await prismaAdmin.$transaction((tx) => undoLegacyBatch(tx, lodge!.id, undo), { timeout: 120_000, maxWait: 20_000 });
    console.log('Desfeito:', res);
    return;
  }

  const names = readdirSync(dir).filter((n) => /\.(csv|xlsx|xls)$/i.test(n));
  const uploads = names.map((n) => ({ name: n, buffer: readFileSync(path.join(dir, n)) }));
  const { reports, files } = await readLegacyFiles(uploads);
  console.log('\n=== Arquivos ===');
  for (const r of reports) console.log(`[${r.status.padEnd(7)}] ${KIND_LABEL[r.kind].padEnd(28)} ${r.name} — ${r.detail}`);

  const matching = (opt('--member-matching') ?? 'exact') as PlanOptions['memberMatching'];
  const options: PlanOptions = { ...DEFAULT_PLAN_OPTIONS, memberMatching: matching };

  let ctx: PlanContext;
  if (lodge) {
    const id = lodge.id;
    const [chart, members, financialAccounts] = await Promise.all([
      prismaAdmin.chartAccount.findMany({ where: { lodgeId: id, active: true }, select: { code: true, name: true, type: true } }),
      prismaAdmin.member.findMany({ where: { lodgeId: id }, select: { id: true, name: true } }),
      prismaAdmin.financialAccount.findMany({ where: { lodgeId: id }, select: { id: true, name: true } }),
    ]);
    ctx = { chart, members, financialAccounts };
    console.log(`Contexto da loja: ${chart.length} contas no plano · ${members.length} membros · ${financialAccounts.length} contas financeiras`);
  } else {
    ctx = { chart: MASONIC_CHART_OF_ACCOUNTS.map((c) => ({ code: c.code, name: c.name, type: c.type })), members: [], financialAccounts: [] };
  }

  const plan = buildPlan(files, ctx, options);
  console.log('\n=== Conferência ===');
  for (const c of plan.checks) console.log(`${c.ok ? 'OK    ' : 'FALHA '} ${c.label}: ${c.detail}`);
  console.log('\n=== Plano ===');
  console.log(plan.summary);
  console.log('Contas financeiras:', plan.financialAccounts.map((a) => `${a.name}${a.existingId ? ' (existe)' : ''} abertura ${money(a.openingBalance)}`).join(' | '));
  console.log(`Sem categoria: ${plan.summary.withoutCategory} (${money(plan.summary.withoutCategoryTotal)})`);
  if (plan.warnings.length) { console.log(`\nAvisos (${plan.warnings.length}):`); plan.warnings.slice(0, 25).forEach((w) => console.log(' -', w)); }

  const out = opt('--export-aligned');
  if (out) { await exportAligned(out, plan, files); console.log(`\nDados alinhados gravados em ${out}`); }

  if (!flag('--yes') || offline || !lodge) {
    console.log('\n[SIMULAÇÃO] Nada foi gravado. Para gravar: sem --offline, com --yes --confirm-host <trecho do host do DATABASE_URL>.');
    return;
  }
  if (!(process.env.DATABASE_URL ?? '').includes(opt('--confirm-host') ?? '\0')) {
    console.error('\n[RECUSADO] --confirm-host não bate com o DATABASE_URL atual.');
    process.exitCode = 1;
    return;
  }
  if (plan.checks.some((c) => !c.ok)) { console.error('\n[RECUSADO] há conferências que não fecharam.'); process.exitCode = 1; return; }

  const lid = lodge.id;
  const previous = await prismaAdmin.$transaction((tx) => findLegacyBatches(tx, lid));
  if (previous.length && !flag('--allow-repeat')) { console.error(`\n[RECUSADO] a loja já tem o lote ${previous.join(', ')}. Use --undo ${previous[0]} ou --allow-repeat.`); process.exitCode = 1; return; }

  const batchId = randomBytes(4).toString('hex');
  console.log(`\nGravando lote ${batchId}...`);
  const res = await prismaAdmin.$transaction((tx) => commitPlan(tx, lid, plan, { batchId }), { timeout: 180_000, maxWait: 20_000 });
  console.log('Concluído:', res);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prismaAdmin.$disconnect());
