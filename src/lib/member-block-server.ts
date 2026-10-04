import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { asaasConflictBody, findOpenAsaasCharges, groupedChargeNumbers, notifyAsaasReceivedInCash, type OpenAsaasCharge } from '@/lib/asaas-manual';
import { brl } from '@/lib/currency';
import { DEGREE_FEE_KINDS } from '@/lib/degree-fee';
import { chartConflict, ensureChart } from '@/lib/degree-fee-server';
import { formatDateOnly, todayBR } from '@/lib/date-only';
import { LATE_CHARGE_CHART } from '@/lib/late-charge';
import { lockKey } from '@/lib/locks';
import { itemRemainders, syncMemberBlock } from '@/lib/member-block-sync';
import { agreementKindLabel, buildInstallments, buildPackage, allocatePayment, BLOCKED_MESSAGE, BLOCKED_STATUS, checkCanBlock, installmentStates, isSettlementKind, paidSoFar, type BlockInput, type DebtInput, type InstallmentState, type PackageItemDraft } from '@/lib/member-block';
import { coversAmount, isValidMoney, round2 } from '@/lib/money';
import { getMemberDuesStatus, isArt002Enabled } from '@/lib/overdue';
import { prismaAdmin, withTenant } from '@/lib/prisma';
import { skipPendingOccurrences } from '@/lib/recurring-rules';
import { cancelAsaasCharges } from '@/lib/asaas-manual';
import { releaseAsaasCharges } from '@/lib/renegotiation';
import { findClosedTermForDate } from '@/lib/term-lock';
import { autoSignReceipt } from '@/lib/receipt-signature-server';
import { dispatch, EMPTY_CHANNELS } from '@/lib/messaging';

type Db = Prisma.TransactionClient;
type Fail = { ok: false; status: number; error: string; [k: string]: unknown };

const FEE_CHART = DEGREE_FEE_KINDS.find((k) => k.kind === 'regularization')!.chart;

/** Mensagem de bloqueio se o irmão está bloqueado (para travar lançamentos novos); null se livre. */
export async function blockedMemberError(db: Db, lodgeId: string, memberId: string | null | undefined): Promise<string | null> {
  if (!memberId) return null;
  const m = await db.member.findFirst({ where: { id: memberId, lodgeId }, select: { status: true } });
  return m?.status === BLOCKED_STATUS ? BLOCKED_MESSAGE : null;
}

/** Dívidas em aberto do irmão (qualquer categoria, vencidas ou a vencer), com o que já foi pago. */
export async function loadMemberDebts(db: Db, lodgeId: string, memberId: string): Promise<DebtInput[]> {
  const accounts = await db.account.findMany({
    where: { lodgeId, memberId, type: 'RECEIVABLE', status: { not: 'paid' }, approvalStatus: 'approved' },
    select: { id: true, title: true, amount: true, dueDate: true, description: true, payments: { select: { amount: true } } },
    orderBy: { dueDate: 'asc' },
  });
  return accounts.map((a) => ({
    accountId: a.id,
    title: a.description ? `${a.title} — ${a.description}` : a.title,
    amount: Number(a.amount),
    paid: a.payments.reduce((s, p) => s + Number(p.amount), 0),
    dueDate: a.dueDate,
  }));
}

export async function previewBlock(db: Db, lodgeId: string, memberId: string, now: Date = new Date()) {
  const [member, lodge, dues, debts] = await Promise.all([
    db.member.findFirst({ where: { id: memberId, lodgeId }, select: { id: true, name: true, status: true } }),
    db.lodge.findUnique({ where: { id: lodgeId }, select: { art002Enabled: true } }),
    getMemberDuesStatus(db, lodgeId, memberId, now),
    loadMemberDebts(db, lodgeId, memberId),
  ]);
  if (!member) return null;
  const check = checkCanBlock(member, dues?.daysOverdue ?? null, isArt002Enabled(lodge));
  const pkg = buildPackage(debts, 0, 0);
  return {
    member,
    daysOverdue: dues?.daysOverdue ?? 0,
    overdueAmount: dues?.amount ?? 0,
    canBlock: check.ok,
    reason: check.ok ? null : check.error,
    // Regularização é valor aberto: negociado e digitado pelo Venerável/Administrador (sem sugestão da filiação).
    suggestedFee: null,
    debts: pkg.items.map((i) => ({ accountId: i.accountId, title: i.title, openAmount: i.openAmount })),
    debtsTotal: pkg.debtsTotal,
  };
}

export type BlockResult = { ok: true; blockId: string; asaasWarning?: string | null } | Fail;

/** Cria as contas a receber da taxa de regularização e da multa/juros (itens sem conta própria ainda). */
async function createFeeAccounts(
  db: Db, lodgeId: string, memberId: string, items: PackageItemDraft[], dueDate: Date, note: string,
): Promise<{ ok: true; ids: Record<'fee' | 'extra', string | null> } | Fail> {
  const ids: Record<'fee' | 'extra', string | null> = { fee: null, extra: null };
  for (const kind of ['fee', 'extra'] as const) {
    const draft = items.find((i) => i.kind === kind);
    if (!draft) continue;
    const seed = kind === 'fee' ? FEE_CHART : LATE_CHARGE_CHART;
    const chartAccountId = await ensureChart(db, lodgeId, seed);
    if (!chartAccountId) return chartConflict(seed);
    const account = await db.account.create({
      data: { lodgeId, type: 'RECEIVABLE', title: draft.title, amount: draft.openAmount, dueDate, memberId, chartAccountId, description: note },
      select: { id: true },
    });
    ids[kind] = account.id;
  }
  return { ok: true, ids };
}

/** Bloqueia o irmão (comunicado à Potência) e monta o acordo na mesma transação. */
export async function blockMember(
  lodgeId: string,
  memberId: string,
  actorId: string,
  input: BlockInput,
  extra: { powerProtocol?: string | null; powerSentAt?: Date | null; note?: string | null },
  now: Date = new Date(),
): Promise<BlockResult> {
  const asaasToCancel: string[] = [];
  const result = await withTenant(lodgeId, async (db): Promise<BlockResult> => {
    await lockKey(db, `member-block:${memberId}`);
    const [member, lodge, dues, debts] = await Promise.all([
      db.member.findFirst({ where: { id: memberId, lodgeId }, select: { id: true, name: true, status: true } }),
      db.lodge.findUnique({ where: { id: lodgeId }, select: { art002Enabled: true } }),
      getMemberDuesStatus(db, lodgeId, memberId, now),
      loadMemberDebts(db, lodgeId, memberId),
    ]);
    if (!member) return { ok: false, status: 404, error: 'Membro não encontrado.' };
    const check = checkCanBlock(member, dues?.daysOverdue ?? null, isArt002Enabled(lodge));
    if (!check.ok) return { ok: false, status: 409, error: check.error };

    const pkg = buildPackage(debts, input.fee, input.extra);
    if (pkg.total <= 0) return { ok: false, status: 409, error: 'Não há dívida em aberto nem taxa a regularizar: nada a incluir no acordo.' };

    const locked = await findClosedTermForDate(db, lodgeId, input.firstDueDate);
    if (locked) return { ok: false, status: 409, error: `Período encerrado (${locked.title}). O vencimento do acordo não pode cair num veneralato já fechado.` };

    const today = todayBR(now);
    const note = `${agreementKindLabel(input.kind)} — bloqueio de ${formatDateOnly(today)}`;
    const created = await createFeeAccounts(db, lodgeId, memberId, pkg.items, input.firstDueDate, note);
    if (!created.ok) return created;
    const itemsByKind = created.ids;

    const block = await db.memberBlock.create({
      data: {
        lodgeId, memberId, blockedById: actorId, kind: input.kind,
        powerProtocol: extra.powerProtocol?.trim() || null,
        powerSentAt: extra.powerSentAt ?? null,
        note: extra.note?.trim() || null,
        overdueDaysAtBlock: dues?.daysOverdue ?? 0,
        overdueAmountAtBlock: dues?.amount ?? 0,
        debtsTotal: pkg.debtsTotal,
        regularizationFee: input.fee,
        extraCharge: input.extra,
        total: pkg.total,
        installments: input.installments,
        firstDueDate: input.firstDueDate,
        items: {
          create: pkg.items.map((i) => ({
            lodgeId,
            accountId: i.accountId ?? (i.kind === 'fee' ? itemsByKind.fee! : itemsByKind.extra!),
            kind: i.kind, title: i.title, openAmount: i.openAmount, sortOrder: i.sortOrder,
          })),
        },
      },
      select: { id: true },
    });
    await db.member.update({ where: { id: memberId }, data: { status: BLOCKED_STATUS } });
    // As dívidas passam a ser cobradas só pelas parcelas do acordo: cobranças abertas no Asaas são desfeitas (cancela depois do commit).
    asaasToCancel.push(...(await releaseAsaasCharges(db, pkg.items.filter((i) => i.kind === 'debt' && i.accountId).map((i) => i.accountId as string))));
    await logAudit(db, {
      lodgeId, userId: actorId, action: 'UPDATE', entity: 'member-block', entityId: block.id,
      metadata: { action: 'block', kind: input.kind, asaasCancelled: asaasToCancel.length, memberId, total: pkg.total, fee: input.fee, extra: input.extra, installments: input.installments, items: pkg.items.length, protocol: extra.powerProtocol ?? null },
    });
    return { ok: true, blockId: block.id };
  });
  if (!result.ok || asaasToCancel.length === 0) return result;
  const asaasWarning = await cancelAsaasCharges(lodgeId, asaasToCancel).catch(() => 'Não foi possível cancelar as cobranças antigas no Asaas; cancele no painel do Asaas para o irmão não pagar o valor antigo.');
  return { ...result, asaasWarning };
}

// ── Situação do acordo ────────────────────────────────────────────────────────

export interface BlockItemView {
  id: string;
  accountId: string;
  kind: string;
  title: string;
  openAmount: number;
  remaining: number;
  sortOrder: number;
}

export interface BlockSummary {
  id: string;
  memberId: string;
  kind: string;
  status: string;
  blockedAt: Date;
  powerProtocol: string | null;
  powerSentAt: Date | null;
  note: string | null;
  overdueDaysAtBlock: number;
  debtsTotal: number;
  regularizationFee: number;
  extraCharge: number;
  total: number;
  installments: number;
  firstDueDate: Date;
  settledAt: Date | null;
  brokenAt: Date | null;
  liftedAt: Date | null;
  items: BlockItemView[];
  paid: number;
  remaining: number;
  schedule: InstallmentState[];
}

type BlockWithItems = Prisma.MemberBlockGetPayload<{ include: { items: true } }>;

export async function summarizeBlock(db: Db, block: BlockWithItems, now: Date = new Date()): Promise<BlockSummary> {
  const rem = await itemRemainders(db, block.items);
  const items = [...block.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({ id: i.id, accountId: i.accountId, kind: i.kind, title: i.title, openAmount: Number(i.openAmount), remaining: rem.get(i.accountId) ?? 0, sortOrder: i.sortOrder }));
  const paid = paidSoFar(items);
  const remaining = round2(items.reduce((s, i) => s + i.remaining, 0));
  const schedule = installmentStates(buildInstallments(Number(block.total), block.installments, block.firstDueDate), paid, todayBR(now));
  return {
    id: block.id, memberId: block.memberId, kind: block.kind, status: block.status, blockedAt: block.blockedAt,
    powerProtocol: block.powerProtocol, powerSentAt: block.powerSentAt, note: block.note,
    overdueDaysAtBlock: block.overdueDaysAtBlock, debtsTotal: Number(block.debtsTotal),
    regularizationFee: Number(block.regularizationFee), extraCharge: Number(block.extraCharge),
    total: Number(block.total), installments: block.installments, firstDueDate: block.firstDueDate,
    settledAt: block.settledAt, brokenAt: block.brokenAt, liftedAt: block.liftedAt,
    items, paid, remaining, schedule,
  };
}

// ── Pagamento do acordo (parcelas) ────────────────────────────────────────────

export type AgreementPaymentResult =
  | { ok: true; applied: { accountId: string; amount: number }[]; paymentIds: string[]; chargeIds: string[]; paidAt: Date }
  | Fail;

/**
 * Registra um pagamento do acordo (à vista ou parcela) e o reparte entre os itens, na ordem do pacote
 * (taxa primeiro, depois a dívida mais antiga). Cada item recebe um Payment na própria conta — assim
 * caixa, DRE e categorias ficam certos mês a mês, e quitar o último item quita o acordo.
 */
type AgreementPaymentInput = { amount: number; bankAccountId: string; paidAt: Date; method: string; note: string; confirmOutsideAsaas: boolean };

export async function recordAgreementPayment(
  lodgeId: string,
  memberId: string,
  actorId: string,
  input: AgreementPaymentInput,
  now: Date = new Date(),
): Promise<AgreementPaymentResult> {
  return withTenant(lodgeId, (db) => applyAgreementPayment(db, lodgeId, memberId, actorId, input, now)).then(async (r) => {
    // Rede (fora da transação): avisa o Asaas das cobranças recebidas por fora.
    if (r.ok && r.chargeIds.length > 0) await notifyAsaasReceivedInCash(lodgeId, r.chargeIds, r.paidAt).catch(() => null);
    return r;
  });
}

/** O mesmo pagamento do acordo, dentro de uma transação já aberta (a baixa pelo extrato concilia a linha na mesma transação). */
export async function applyAgreementPayment(
  db: Db,
  lodgeId: string,
  memberId: string,
  actorId: string,
  input: AgreementPaymentInput,
  now: Date = new Date(),
): Promise<AgreementPaymentResult> {
    await lockKey(db, `member-block:${memberId}`);
    if (!isValidMoney(input.amount)) return { ok: false, status: 400, error: 'Informe um valor maior que zero, com até 2 casas decimais.' };
    const block = await db.memberBlock.findFirst({ where: { lodgeId, memberId, status: 'open' }, include: { items: true } });
    if (!block) return { ok: false, status: 404, error: 'Não há acordo em aberto para este irmão.' };

    const locked = await findClosedTermForDate(db, lodgeId, input.paidAt);
    if (locked) return { ok: false, status: 409, error: `Período encerrado (${locked.title}). Não é possível baixar pagamento dentro de um veneralato já fechado.` };
    const bank = await db.financialAccount.findFirst({ where: { id: input.bankAccountId, lodgeId, active: true }, select: { id: true } });
    if (!bank) return { ok: false, status: 400, error: 'Conta bancária/caixa inválida ou inativa.' };

    const rem = await itemRemainders(db, block.items);
    const open = block.items.map((i) => ({ itemId: i.id, accountId: i.accountId, remaining: rem.get(i.accountId) ?? 0, sortOrder: i.sortOrder }));
    const remainingTotal = round2(open.reduce((s, i) => s + i.remaining, 0));
    if (input.amount > remainingTotal) {
      return { ok: false, status: 400, error: remainingTotal > 0 ? `Valor maior que o saldo do acordo (${brl(remainingTotal)}).` : 'O acordo já está quitado.' };
    }

    const { allocations } = allocatePayment(open, input.amount);

    // Cobrança aberta no Asaas em algum item: a baixa é do Asaas — só segue com a confirmação de que
    // foi recebido por fora (depois o Asaas é avisado). Pix agrupado aberto trava, como na baixa avulsa.
    const charges: OpenAsaasCharge[] = [];
    for (const a of allocations) charges.push(...(await findOpenAsaasCharges(db, { accountId: a.accountId, memberId })));
    const grouped = await groupedChargeNumbers(db, charges);
    if (grouped.length > 0) {
      return { ok: false, status: 409, code: 'ASAAS_GROUP_OPEN', error: `A cobrança ${grouped.join(', ')} faz parte de um Pix agrupado aberto no Asaas. Aguarde a confirmação ou reemita a cobrança em Cobranças e registre a baixa depois.` };
    }
    if (charges.length > 0 && !input.confirmOutsideAsaas) {
      return { ok: false, status: 409, ...asaasConflictBody(charges) };
    }

    const paymentIds: string[] = [];
    for (const a of allocations) {
      const account = await db.account.findFirst({ where: { id: a.accountId, lodgeId }, select: { id: true, amount: true } });
      if (!account) continue;
      await lockKey(db, `account:${account.id}`);
      const agreementPayment = await db.payment.create({
        data: {
          lodgeId, accountId: account.id, memberId, bankAccountId: bank.id, amount: a.amount, paidAt: input.paidAt,
          method: input.method || 'manual', note: input.note || `Pagamento do ${agreementKindLabel(block.kind).toLowerCase()}`,
        },
        select: { id: true },
      });
      paymentIds.push(agreementPayment.id);
      await autoSignReceipt(db, lodgeId, agreementPayment.id, actorId);
      const agg = await db.payment.aggregate({ _sum: { amount: true }, where: { accountId: account.id } });
      const paid = coversAmount(Number(agg._sum.amount ?? 0), Number(account.amount));
      await db.account.update({ where: { id: account.id }, data: { status: paid ? 'paid' : 'pending' } });
      if (paid) await db.invoice.updateMany({ where: { accountId: account.id, status: { not: 'paid' } }, data: { status: 'paid' } });
    }
    await syncMemberBlock(db, lodgeId, memberId, now);
    await logAudit(db, {
      lodgeId, userId: actorId, action: 'CREATE', entity: 'member-block-payment', entityId: block.id,
      metadata: { memberId, amount: input.amount, method: input.method, items: allocations.length },
    });
    return { ok: true, applied: allocations.map((a) => ({ accountId: a.accountId, amount: a.amount })), paymentIds, chargeIds: charges.map((c) => c.id), paidAt: input.paidAt };
}

// ── Retorno do irmão ──────────────────────────────────────────────────────────

/**
 * Encerra o bloqueio depois do acordo quitado. Padrão ("active"): o irmão volta — situação "Ativo" e a
 * recorrência recomeça no próximo vencimento. "placet": só para o acordo de QUITAÇÃO — o irmão pagou o que
 * devia à loja, não vai regularizar e pediu o Placet: a situação vira "Quit Placet".
 */
export async function liftBlock(lodgeId: string, memberId: string, actorId: string, now: Date = new Date(), outcome: 'active' | 'placet' = 'active'): Promise<{ ok: true } | Fail> {
  return withTenant(lodgeId, async (db): Promise<{ ok: true } | Fail> => {
    await lockKey(db, `member-block:${memberId}`);
    await syncMemberBlock(db, lodgeId, memberId, now);
    const block = await db.memberBlock.findFirst({ where: { lodgeId, memberId, status: { in: ['open', 'settled'] } } });
    if (!block) return { ok: false, status: 404, error: 'Este irmão não está bloqueado.' };
    if (block.status !== 'settled') return { ok: false, status: 409, error: 'O irmão só volta depois que o acordo estiver totalmente pago.' };
    if (outcome === 'placet' && !isSettlementKind(block.kind)) return { ok: false, status: 409, error: 'O Placet por este caminho vale só para o acordo de quitação de dívidas.' };

    const today = todayBR(now);
    // O período bloqueado não gera mensalidade: pula as ocorrências vencidas das recorrências do irmão.
    const templates = await db.invoice.findMany({
      where: { lodgeId, memberId, isRecurring: true, nextDueDate: { lte: today } },
      select: { id: true, nextDueDate: true, recurringInterval: true, recurringCount: true },
    });
    for (const t of templates) {
      const next = skipPendingOccurrences(t.nextDueDate!, t.recurringInterval ?? 'monthly', t.recurringCount, today);
      await db.invoice.update({ where: { id: t.id }, data: { nextDueDate: next.nextDueDate, recurringCount: next.remaining, isRecurring: next.isRecurring } });
    }

    await db.memberBlock.update({ where: { id: block.id }, data: { status: 'lifted', liftedAt: now, liftedById: actorId } });
    await db.member.update({ where: { id: memberId }, data: { status: outcome === 'placet' ? 'quit_placet' : 'active' } });
    await logAudit(db, { lodgeId, userId: actorId, action: 'UPDATE', entity: 'member-block', entityId: block.id, metadata: { action: outcome === 'placet' ? 'placet' : 'lift', memberId, skippedRecurrences: templates.length } });
    return { ok: true };
  });
}

/**
 * Depois de quitar as dívidas (acordo de quitação), o irmão decide regularizar: abre-se um acordo de
 * REGULARIZAÇÃO só com a taxa (e multa/juros, se houver). O acordo de quitação é encerrado e o irmão
 * segue bloqueado até pagar a taxa. Protocolo e data do comunicado à Potência acompanham.
 */
export async function regularizeSettledBlock(
  lodgeId: string,
  memberId: string,
  actorId: string,
  input: BlockInput,
  now: Date = new Date(),
): Promise<BlockResult> {
  return withTenant(lodgeId, async (db): Promise<BlockResult> => {
    await lockKey(db, `member-block:${memberId}`);
    await syncMemberBlock(db, lodgeId, memberId, now);
    const previous = await db.memberBlock.findFirst({ where: { lodgeId, memberId, status: 'settled', kind: 'settlement' } });
    if (!previous) return { ok: false, status: 409, error: 'Só um acordo de quitação já pago pode virar acordo de regularização.' };
    if (input.fee + input.extra <= 0) return { ok: false, status: 400, error: 'Informe a taxa de regularização (maior que zero).' };

    const locked = await findClosedTermForDate(db, lodgeId, input.firstDueDate);
    if (locked) return { ok: false, status: 409, error: `Período encerrado (${locked.title}). O vencimento do acordo não pode cair num veneralato já fechado.` };

    // Dívidas novas (se houver) entram junto; as quitadas já saíram do saldo.
    const debts = await loadMemberDebts(db, lodgeId, memberId);
    const pkg = buildPackage(debts, input.fee, input.extra);
    const note = `${agreementKindLabel('regularization')} — após quitação de ${formatDateOnly(todayBR(now))}`;
    const created = await createFeeAccounts(db, lodgeId, memberId, pkg.items, input.firstDueDate, note);
    if (!created.ok) return created;

    const block = await db.memberBlock.create({
      data: {
        lodgeId, memberId, blockedById: actorId, kind: 'regularization',
        powerProtocol: previous.powerProtocol, powerSentAt: previous.powerSentAt, note: previous.note,
        overdueDaysAtBlock: previous.overdueDaysAtBlock, overdueAmountAtBlock: previous.overdueAmountAtBlock,
        debtsTotal: pkg.debtsTotal, regularizationFee: input.fee, extraCharge: input.extra, total: pkg.total,
        installments: input.installments, firstDueDate: input.firstDueDate,
        items: {
          create: pkg.items.map((i) => ({
            lodgeId,
            accountId: i.accountId ?? (i.kind === 'fee' ? created.ids.fee! : created.ids.extra!),
            kind: i.kind, title: i.title, openAmount: i.openAmount, sortOrder: i.sortOrder,
          })),
        },
      },
      select: { id: true },
    });
    // O acordo de quitação se encerra; o irmão NÃO volta (segue bloqueado até a regularização).
    await db.memberBlock.update({ where: { id: previous.id }, data: { status: 'lifted', liftedAt: now, liftedById: actorId } });
    await logAudit(db, {
      lodgeId, userId: actorId, action: 'UPDATE', entity: 'member-block', entityId: block.id,
      metadata: { action: 'regularize-after-settlement', memberId, previousBlockId: previous.id, fee: input.fee, extra: input.extra, installments: input.installments },
    });
    return { ok: true, blockId: block.id };
  });
}

// ── Alerta de quebra de acordo ────────────────────────────────────────────────

/**
 * Cron diário: acordo aberto com parcela vencida e não coberta pelo que foi pago = acordo quebrado.
 * Avisa por e-mail o Tesoureiro, o Venerável e os Administradores (uma única vez por acordo) — o
 * irmão continua bloqueado; as medidas cabíveis são decididas por eles.
 */
export async function alertBrokenAgreements(now: Date = new Date()): Promise<{ checked: number; broken: number; emails: number }> {
  const open = await prismaAdmin.memberBlock.findMany({ where: { status: 'open', brokenAt: null }, select: { id: true, lodgeId: true, memberId: true } });
  const stats = { checked: open.length, broken: 0, emails: 0 };
  for (const ref of open) {
    try {
      const ctx = await withTenant(ref.lodgeId, async (db) => {
        const block = await db.memberBlock.findFirst({ where: { id: ref.id, status: 'open', brokenAt: null }, include: { items: true } });
        if (!block) return null;
        const summary = await summarizeBlock(db, block, now);
        const late = summary.schedule.filter((s) => s.late);
        if (late.length === 0) return null;
        await db.memberBlock.update({ where: { id: block.id }, data: { brokenAt: now } });
        const [member, lodge, staff] = await Promise.all([
          db.member.findUnique({ where: { id: block.memberId }, select: { name: true } }),
          db.lodge.findUnique({ where: { id: ref.lodgeId }, select: { name: true } }),
          db.user.findMany({ where: { lodgeId: ref.lodgeId, role: { in: ['treasurer', 'venerable', 'admin'] }, status: 'active' }, select: { email: true } }),
        ]);
        return { summary, late, member, lodge, staff, kindLabel: agreementKindLabel(block.kind) };
      });
      if (!ctx) continue;
      stats.broken++;
      const { summary, late, member, lodge, staff, kindLabel } = ctx;
      const lines = late.map((s) => `• Parcela ${s.number}/${summary.installments}: ${brl(s.amount)} com vencimento em ${formatDateOnly(s.dueDate)}`).join('\n');
      const subject = `${kindLabel} em atraso — ${member?.name ?? 'irmão'}`;
      const body =
        `O ${kindLabel.toLowerCase()} do irmão ${member?.name ?? ''} (${lodge?.name ?? ''}) está com parcela vencida e não paga.\n\n${lines}\n\n` +
        `Total do acordo: ${brl(summary.total)} · Pago: ${brl(summary.paid)} · Saldo: ${brl(summary.remaining)}.\n` +
        `O irmão continua bloqueado. Providencie as medidas cabíveis em Tesouraria → Acordos.`;
      for (const to of new Set(staff.map((u) => u.email).filter(Boolean))) {
        const r = await dispatch('email', to, subject, body, EMPTY_CHANNELS).catch(() => null);
        if (r?.status === 'sent') stats.emails++;
      }
    } catch (err) {
      console.error('acordo de regularização: falha ao checar atraso', { blockId: ref.id, err });
    }
  }
  return stats;
}
