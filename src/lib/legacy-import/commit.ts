// Grava no banco o plano montado por planner.ts. Recebe o cliente de transação
// (withTenant no app, prismaAdmin.$transaction nos scripts) — não abre conexão
// própria. Toda linha criada carrega a marca "[import:legacy:<lote>]" (em
// description/note/notes), que é o que permite desfazer o lote inteiro sem
// tocar em nada digitado à mão.

import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import type { ImportPlan } from './planner';

export const LEGACY_TAG_PREFIX = 'import:legacy:';
export const tagOf = (batchId: string) => `[${LEGACY_TAG_PREFIX}${batchId}]`;

const CHUNK = 400;
async function inChunks<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await fn(rows.slice(i, i + CHUNK));
}

/**
 * Lotes de importação já gravados nesta loja (para avisar antes de duplicar). Feito no banco
 * (DISTINCT sobre a marca) em vez de trazer todas as contas do lote — um lote tem milhares de linhas
 * e esta consulta roda a cada análise.
 */
export async function findLegacyBatches(db: Prisma.TransactionClient, lodgeId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ batch: string }[]>`
    SELECT DISTINCT substring("description" from '\\[import:legacy:([^\\]]+)\\]') AS batch
    FROM "Account"
    WHERE "lodgeId" = ${lodgeId} AND "description" LIKE '%[import:legacy:%'`;
  return rows.map((r) => r.batch).filter(Boolean);
}

export interface CommitResult {
  batchId: string;
  financialAccountsCreated: number;
  openingBalancesSet: number;
  counterparties: number;
  transactions: number;
  openItems: number;
  transfers: number;
  balancete: boolean;
  notes: string[];
}

export async function commitPlan(
  db: Prisma.TransactionClient,
  lodgeId: string,
  plan: ImportPlan,
  params: { batchId: string; createdById?: string | null },
): Promise<CommitResult> {
  const { batchId } = params;
  const tag = tagOf(batchId);
  const notes: string[] = [];

  const [chart, existingFa, existingCp] = await Promise.all([
    db.chartAccount.findMany({ where: { lodgeId }, select: { id: true, code: true } }),
    db.financialAccount.findMany({ where: { lodgeId }, select: { id: true, name: true, openingBalance: true } }),
    db.counterparty.findMany({ where: { lodgeId }, select: { id: true, name: true, document: true } }),
  ]);
  const chartId = new Map(chart.map((c) => [c.code, c.id]));

  // ---- contas financeiras (Caixa, bancos) ----
  const faId = new Map<string, string>();
  let created = 0;
  let openingSet = 0;
  for (const fa of plan.financialAccounts) {
    const existing = fa.existingId ? existingFa.find((e) => e.id === fa.existingId) : null;
    if (existing) {
      faId.set(fa.name, existing.id);
      if (fa.openingBalance !== 0 && existing.openingBalance === 0) {
        await db.financialAccount.update({ where: { id: existing.id }, data: { openingBalance: fa.openingBalance } });
        openingSet++;
      } else if (fa.openingBalance !== 0) {
        notes.push(`Conta "${fa.name}" já existia com saldo inicial ${existing.openingBalance.toFixed(2)}; o saldo de abertura importado (${fa.openingBalance.toFixed(2)}) NÃO foi aplicado.`);
      }
      continue;
    }
    const row = await db.financialAccount.create({
      data: {
        lodgeId, name: fa.name, kind: fa.kind, bankName: fa.bankName, isInvestment: fa.isInvestment, openingBalance: fa.openingBalance,
      },
      select: { id: true },
    });
    faId.set(fa.name, row.id);
    created++;
    if (fa.openingBalance !== 0) openingSet++;
  }

  // ---- contrapartes: reaproveita quem já existe (documento, senão nome) ----
  const cpId = new Map<string, string>();
  const byDoc = new Map(existingCp.filter((c) => c.document).map((c) => [c.document!, c.id]));
  const byName = new Map(existingCp.map((c) => [c.name.trim().toUpperCase(), c.id]));
  const toCreate = plan.counterparties.filter((c) => {
    const hit = (c.document && byDoc.get(c.document)) || byName.get(c.name.trim().toUpperCase());
    if (hit) { cpId.set(c.key, hit); return false; }
    return true;
  });
  await inChunks(toCreate, async (chunk) => {
    const rows = await db.counterparty.createManyAndReturn({
      data: chunk.map((c) => ({
        lodgeId, kind: c.kind, name: c.name, document: c.document, isCompany: c.isCompany, phone: c.phone, city: c.city, state: c.state,
        notes: [c.notes, tag].filter(Boolean).join(' '),
      })),
      select: { id: true, name: true },
    });
    const keyByName = new Map(chunk.map((c) => [c.name, c.key]));
    for (const r of rows) { const k = keyByName.get(r.name); if (k) cpId.set(k, r.id); }
  });

  // ---- lançamentos realizados: Conta (paga) + Pagamento ----
  const accounts: Prisma.AccountCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  for (const t of plan.transactions) {
    const id = randomUUID();
    const bankAccountId = faId.get(t.account) ?? null;
    if (!bankAccountId) notes.push(`Lançamento de ${t.date} (${t.amount.toFixed(2)}) sem conta financeira "${t.account}".`);
    accounts.push({
      id, lodgeId, memberId: t.memberId, counterpartyId: t.counterpartyKey ? cpId.get(t.counterpartyKey) ?? null : null,
      chartAccountId: t.chartCode ? chartId.get(t.chartCode) ?? null : null,
      bankAccountId, type: t.type, title: t.title.slice(0, 200), amount: t.amount, dueDate: new Date(t.date), status: 'paid', isDues: t.isDues,
      description: `${t.description} ${tag}`, counterpartyName: t.counterpartyKey ? t.name : null,
    });
    payments.push({
      lodgeId, accountId: id, memberId: t.memberId, bankAccountId, amount: t.amount, paidAt: new Date(t.date), method: 'import', note: tag,
    });
  }

  // ---- contas em aberto ----
  for (const it of plan.openItems) {
    accounts.push({
      lodgeId, memberId: it.memberId, counterpartyId: it.counterpartyKey ? cpId.get(it.counterpartyKey) ?? null : null,
      chartAccountId: it.chartCode ? chartId.get(it.chartCode) ?? null : null,
      type: it.type, title: it.title, amount: it.amount, dueDate: new Date(it.dueDate), status: 'pending', isDues: it.isDues,
      description: `${it.description} ${tag}`, counterpartyName: it.counterpartyKey ? it.name : null,
    });
  }
  await inChunks(accounts, (chunk) => db.account.createMany({ data: chunk }));
  await inChunks(payments, (chunk) => db.payment.createMany({ data: chunk }));

  // ---- transferências entre contas próprias (já aprovadas: são fato passado) ----
  const transfers = plan.transfers.flatMap((t) => {
    const fromId = faId.get(t.from);
    const toId = faId.get(t.to);
    if (!fromId || !toId) { notes.push(`Transferência ${t.from} → ${t.to} (${t.date}) ignorada: conta não encontrada.`); return []; }
    return [{ lodgeId, fromId, toId, amount: t.amount, date: new Date(t.date), note: `${t.note} ${tag}`, status: 'approved', createdById: params.createdById ?? null, approvedAt: new Date(t.date) }];
  });
  if (transfers.length) await db.accountTransfer.createMany({ data: transfers });

  // ---- balancete arquivado ----
  let balancete = false;
  if (plan.balancete) {
    const b = plan.balancete;
    const dup = await db.balancete.findFirst({ where: { lodgeId, source: 'import', periodFrom: new Date(b.periodFrom), periodTo: new Date(`${b.periodTo}T23:59:59.999Z`) } });
    if (dup) notes.push('Já existe um balancete importado para este período — não foi criado outro.');
    else {
      await db.balancete.create({
        data: {
          lodgeId, periodFrom: new Date(b.periodFrom), periodTo: new Date(`${b.periodTo}T23:59:59.999Z`),
          totalReceivables: b.totalReceivables, totalPayables: b.totalPayables, totalPayments: b.totalPayments, netBalance: b.netBalance,
          notes: `${b.notes} ${tag}`, createdById: params.createdById ?? null, source: 'import', detail: b.lines as unknown as Prisma.InputJsonValue,
        },
      });
      balancete = true;
    }
  }

  return {
    batchId,
    financialAccountsCreated: created,
    openingBalancesSet: openingSet,
    counterparties: toCreate.length,
    transactions: plan.transactions.length,
    openItems: plan.openItems.length,
    transfers: transfers.length,
    balancete,
    notes,
  };
}

/** Remove tudo que o lote criou (contas, pagamentos por cascata, transferências, contrapartes, balancete). Contas financeiras ficam. */
export async function undoLegacyBatch(db: Prisma.TransactionClient, lodgeId: string, batchId: string) {
  const tag = tagOf(batchId);
  const transfers = await db.accountTransfer.deleteMany({ where: { lodgeId, note: { contains: tag } } });
  const accounts = await db.account.deleteMany({ where: { lodgeId, description: { contains: tag } } });
  const balancetes = await db.balancete.deleteMany({ where: { lodgeId, notes: { contains: tag } } });
  const counterparties = await db.counterparty.deleteMany({ where: { lodgeId, notes: { contains: tag } } });
  return { transfers: transfers.count, accounts: accounts.count, balancetes: balancetes.count, counterparties: counterparties.count };
}
