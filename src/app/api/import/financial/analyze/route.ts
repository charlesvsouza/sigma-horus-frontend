import { NextResponse } from 'next/server';
import { withTenant } from '@/lib/prisma';
import { findLegacyBatches } from '@/lib/legacy-import/commit';
import { KIND_LABEL } from '@/lib/legacy-import/service';
import { parseOptions, planFor, readUploads, resolveActor } from '../shared';

export const maxDuration = 60;

// Passo 1 (somente leitura): lê os arquivos, monta o plano e devolve o que SERIA importado —
// conferências de totais, categorias sugeridas, amostras. Nada é gravado.
export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Envie os arquivos como formulário (multipart).' }, { status: 400 });

  const actor = await resolveActor(request, formData.get('lodgeId') ? String(formData.get('lodgeId')) : null);
  if ('error' in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const options = parseOptions(formData.get('options'));
  if ('error' in options) return NextResponse.json({ error: options.error }, { status: 400 });

  const read = await readUploads(formData);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });

  const { reports, files } = read;
  if (!files.extrato && !files.balancete && !files.clients && !files.suppliers && !files.openItems) {
    return NextResponse.json({ error: 'Nenhum dos arquivos enviados pôde ser usado.', reports: reports.map((r) => ({ ...r, kindLabel: KIND_LABEL[r.kind] })) }, { status: 400 });
  }

  const { plan, chart } = await planFor(actor.lodgeId, files, options);
  const batches = await withTenant(actor.lodgeId, (db) => findLegacyBatches(db, actor.lodgeId));

  return NextResponse.json({
    reports: reports.map((r) => ({ ...r, kindLabel: KIND_LABEL[r.kind] })),
    summary: plan.summary,
    checks: plan.checks,
    warnings: plan.warnings.slice(0, 60),
    warningsTotal: plan.warnings.length,
    categories: plan.categories,
    chartOptions: chart,
    financialAccounts: plan.financialAccounts,
    counterparties: plan.counterparties.slice(0, 200).map((c) => ({ name: c.name, kind: c.kind, document: c.document, phone: c.phone })),
    transactionSample: plan.transactions.slice(0, 25).map((t) => ({ date: t.date, account: t.account, type: t.type, amount: t.amount, name: t.name, title: t.title, chartCode: t.chartCode })),
    uncategorizedSample: plan.transactions.filter((t) => !t.chartCode).slice(0, 40).map((t) => ({ date: t.date, type: t.type, amount: t.amount, name: t.name, title: t.title })),
    openItemSample: plan.openItems.slice(0, 20).map((i) => ({ dueDate: i.dueDate, name: i.name, amount: i.amount })),
    balancete: plan.balancete
      ? { periodFrom: plan.balancete.periodFrom, periodTo: plan.balancete.periodTo, totalReceivables: plan.balancete.totalReceivables, totalPayables: plan.balancete.totalPayables, netBalance: plan.balancete.netBalance, lines: plan.balancete.lines.length }
      : null,
    existingBatches: batches,
  });
}
