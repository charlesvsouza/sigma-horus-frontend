import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { nextInvoiceNumbers } from '@/lib/charges';
import { lockKey } from '@/lib/locks';
import { findClosedTermForDate } from '@/lib/term-lock';
import { isValidMoney } from '@/lib/money';
import {
  DEGREE_FEE_CARD_REF_PREFIX, DEGREE_FEE_REFUND_CHART, MAX_INSTALLMENTS, cardGrossUp, checkEligibility, degreeFeeKind, installmentTitle,
  splitInstallments, summarizePlan, type DegreeFeeKind,
} from '@/lib/degree-fee';
import { createCustomer, createInstallment, deleteInstallment, listInstallmentPayments } from '@/lib/asaas';
import { buildLodgeAsaasConfig } from '@/lib/asaas-config';
import { isAsaasMode } from '@/lib/collection';
import { withTenant } from '@/lib/prisma';

type Db = Prisma.TransactionClient;
type Fail = { ok: false; status: number; error: string };

/**
 * Categoria do plano de contas pelo código (a da loja, com o nome que ela tiver);
 * cria com o nome padrão se faltar. Código ocupado por categoria de OUTRO tipo
 * (ex.: despesa no 1.1.08) devolve null — melhor recusar do que lançar na categoria errada.
 */
async function ensureChart(db: Db, lodgeId: string, seed: { code: string; name: string; type: string; category: string }): Promise<string | null> {
  const found = await db.chartAccount.findFirst({ where: { lodgeId, code: seed.code }, select: { id: true, type: true } });
  if (found) return found.type === seed.type ? found.id : null;
  return (await db.chartAccount.create({ data: { lodgeId, ...seed }, select: { id: true } })).id;
}
const chartConflict = (seed: { code: string; name: string }): Fail => ({
  ok: false, status: 409,
  error: `O código ${seed.code} do plano de contas está em uso por uma categoria de outro tipo. Ajuste em Cadastros financeiros (o sistema usa ${seed.code} para "${seed.name}").`,
});

export interface CreatePlanInput {
  lodgeId: string;
  userId: string;
  memberId: string;
  kind: string;
  installments: number;
  firstDueDate: Date;
  fourthInstructionDate: Date | null;
  notes?: string | null;
  /** standard = Pix/boleto por cota; card = cartão parcelado no Asaas, com repasse da tarifa. */
  paymentMethod?: 'standard' | 'card';
}

/**
 * Cria o plano e as cotas — cada cota é Account (a receber, do irmão) + Invoice,
 * igual a uma cobrança de Cobranças: portal, Pix, emissão automática no Asaas,
 * recibo e lembretes funcionam sem nada específico. O valor vem da configuração
 * da loja e fica TRAVADO no plano.
 */
export async function createDegreeFeePlan(db: Db, input: CreatePlanInput): Promise<{ ok: true; planId: string } | Fail> {
  const def = degreeFeeKind(input.kind);
  if (!def) return { ok: false, status: 400, error: 'Escolha a taxa: iniciação, elevação ou exaltação.' };
  const n = Math.trunc(input.installments);
  if (!(n >= 1 && n <= MAX_INSTALLMENTS)) return { ok: false, status: 400, error: `Parcelamento de 1 a ${MAX_INSTALLMENTS} cotas.` };
  if (Number.isNaN(input.firstDueDate.getTime())) return { ok: false, status: 400, error: 'Informe o vencimento da 1ª cota.' };

  const lodge = await db.lodge.findUnique({
    where: { id: input.lodgeId },
    select: {
      initiationFee: true, elevationFee: true, exaltationFee: true, affiliationFee: true,
      collectionMode: true, asaasApiKeyEnc: true, asaasSettlementAccountId: true,
      degreeFeeCardEnabled: true, cardFeePercentOneTime: true, cardFeePercentInstallment: true, cardFeeFixed: true,
    },
  });
  const total = lodge?.[def.lodgeField] ?? null;
  if (total == null || !isValidMoney(total)) {
    return { ok: false, status: 400, error: `Configure o valor da ${def.label.toLowerCase()} em Configurações da loja → Financeiro.` };
  }

  const card = input.paymentMethod === 'card';
  if (card) {
    // Cartão só no Modo Asaas (no Modo Loja não há cartão) e se a loja ligou a opção.
    if (!isAsaasMode(lodge)) return { ok: false, status: 409, error: 'Cartão de crédito só no Modo Asaas. No Modo Loja, as cotas são pagas por Pix.' };
    if (!lodge?.degreeFeeCardEnabled) return { ok: false, status: 409, error: 'Ligue o cartão parcelado nas taxas de grau em Configurações da loja → Financeiro.' };
    if (!lodge.asaasApiKeyEnc) return { ok: false, status: 409, error: 'Asaas não conectado para esta loja. Configure em Integrações.' };
    if (!lodge.asaasSettlementAccountId) return { ok: false, status: 409, error: 'Escolha a conta corrente que recebe o repasse do Asaas em Configurações da loja → Recebimento das cobranças.' };
  }

  const member = await db.member.findFirst({
    where: { id: input.memberId, lodgeId: input.lodgeId },
    select: { id: true, name: true, status: true, cpf: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true, candidateProcess: { select: { admissionKind: true } } },
  });
  if (!member) return { ok: false, status: 404, error: 'Irmão não encontrado.' };
  if (card && !member.cpf) return { ok: false, status: 400, error: 'Para pagar no cartão pelo Asaas, o irmão precisa ter CPF no cadastro.' };
  const eligible = checkEligibility(def.kind, { ...member, admissionKind: member.candidateProcess?.admissionKind ?? null }, input.fourthInstructionDate);
  if (!eligible.ok) return { ok: false, status: 400, error: eligible.error };

  // Duplo clique: sem a trava, duas requisições passam juntas pela conferência e criam dois planos ativos.
  await lockKey(db, `degree-plan:${input.lodgeId}:${member.id}:${def.kind}`);
  const existing = await db.degreeFeePlan.findFirst({ where: { lodgeId: input.lodgeId, memberId: member.id, kind: def.kind, status: 'active' }, select: { id: true } });
  if (existing) return { ok: false, status: 409, error: `${member.name} já tem um plano ativo da ${def.label.toLowerCase()}.` };

  const locked = await findClosedTermForDate(db, input.lodgeId, input.firstDueDate);
  if (locked) return { ok: false, status: 409, error: `Período encerrado (${locked.title}). Escolha um vencimento depois do veneralato fechado.` };

  const chartAccountId = await ensureChart(db, input.lodgeId, def.chart);
  if (!chartAccountId) return chartConflict(def.chart);
  let cotas = splitInstallments(total, n, input.firstDueDate);
  let cardSurcharge: number | null = null;
  if (card) {
    const gross = cardGrossUp(total, n, { percentOneTime: lodge!.cardFeePercentOneTime, percentInstallment: lodge!.cardFeePercentInstallment, fixed: lodge!.cardFeeFixed });
    if (!gross.ok) return { ok: false, status: 400, error: gross.error };
    // Cotas no cartão já com o repasse: o Asaas cobra o valor cheio e a tarifa real sai como despesa na baixa.
    cotas = cotas.map((c) => ({ ...c, amount: gross.installmentValue }));
    cardSurcharge = gross.surcharge;
  }
  const plan = await db.degreeFeePlan.create({
    data: {
      lodgeId: input.lodgeId,
      memberId: member.id,
      kind: def.kind,
      totalAmount: total,
      installments: n,
      firstDueDate: input.firstDueDate,
      fourthInstructionDate: def.kind === 'elevation' || def.kind === 'exaltation' ? input.fourthInstructionDate : null,
      paymentMethod: card ? 'card' : 'standard',
      cardSurcharge,
      notes: input.notes?.trim() || null,
      createdById: input.userId,
    },
    select: { id: true },
  });
  const numbers = await nextInvoiceNumbers(db, input.lodgeId, n);
  const description = card
    ? `Plano da ${def.label.toLowerCase()} no cartão de crédito (${n}x, com repasse da tarifa do cartão).`
    : `Plano da ${def.label.toLowerCase()}: deve estar quitada até a data da ${def.event}.`;
  for (const [i, c] of cotas.entries()) {
    const account = await db.account.create({
      data: {
        lodgeId: input.lodgeId, type: 'RECEIVABLE', title: installmentTitle(def, c.number, n), amount: c.amount, dueDate: c.dueDate,
        description, memberId: member.id, chartAccountId, degreeFeePlanId: plan.id,
      },
      select: { id: true },
    });
    await db.invoice.create({
      data: { lodgeId: input.lodgeId, accountId: account.id, memberId: member.id, number: numbers[i], amount: c.amount, dueDate: c.dueDate, description },
    });
  }
  await logAudit(db, { lodgeId: input.lodgeId, userId: input.userId, action: 'CREATE', entity: 'degreeFeePlan', entityId: plan.id, metadata: { member: member.name, kind: def.kind, total, installments: n, paymentMethod: card ? 'card' : 'standard', cardSurcharge } });
  return { ok: true, planId: plan.id };
}

export const PLAN_INCLUDE = {
  member: { select: { id: true, name: true, status: true, cpf: true, initiationDate: true, elevationDate: true, exaltationDate: true } },
  accounts: {
    where: { type: 'RECEIVABLE' },
    select: {
      id: true, title: true, amount: true, dueDate: true, status: true,
      payments: { select: { amount: true, paidAt: true } },
      invoices: { select: { id: true, number: true, asaasPaymentId: true, asaasInvoiceUrl: true, status: true } },
    },
    orderBy: { dueDate: 'asc' as const },
  },
} as const;

type PlanRow = Prisma.DegreeFeePlanGetPayload<{ include: typeof PLAN_INCLUDE }>;

export function presentPlan(p: PlanRow, today: Date = new Date()) {
  const def = degreeFeeKind(p.kind)!;
  const cotas = p.accounts.map((a) => {
    const paid = a.payments.reduce((s, x) => s + Number(x.amount), 0);
    return {
      id: a.id, title: a.title, amount: Number(a.amount), dueDate: a.dueDate.toISOString(), status: a.status, paid,
      paidAt: a.payments.length ? a.payments[a.payments.length - 1].paidAt.toISOString() : null,
      invoiceNumber: a.invoices[0]?.number ?? null, emitted: a.invoices.some((i) => Boolean(i.asaasPaymentId)),
    };
  });
  const eventDone = def.memberDateField ? Boolean(p.member[def.memberDateField]) : false;
  const summary = summarizePlan(p, cotas, eventDone, today, def.memberDateField !== null);
  return {
    id: p.id, kind: p.kind, label: def.label, event: def.event,
    member: { id: p.member.id, name: p.member.name },
    totalAmount: Number(p.totalAmount), installments: p.installments,
    paymentMethod: p.paymentMethod, cardSurcharge: p.cardSurcharge == null ? null : Number(p.cardSurcharge),
    cardUrl: p.paymentMethod === 'card' ? (p.accounts.flatMap((a) => a.invoices).find((i) => i.asaasInvoiceUrl)?.asaasInvoiceUrl ?? null) : null,
    firstDueDate: p.firstDueDate.toISOString(),
    fourthInstructionDate: p.fourthInstructionDate?.toISOString() ?? null,
    expectedEventDate: p.expectedEventDate?.toISOString() ?? null,
    status: p.status, canceledAt: p.canceledAt?.toISOString() ?? null, cancelReason: p.cancelReason,
    refundAccountId: p.refundAccountId, notes: p.notes, createdAt: p.createdAt.toISOString(),
    cotas, summary,
  };
}
export type PresentedPlan = ReturnType<typeof presentPlan>;

/**
 * Antecipa para a data prevista do evento as cotas em aberto que venceriam depois
 * dela (a taxa precisa estar quitada até o evento). Cota já emitida no Asaas não é
 * mexida (ela vence em poucos dias de qualquer forma — a emissão é 3 dias antes).
 */
export async function anticipateToEvent(db: Db, lodgeId: string, planId: string, userId: string): Promise<{ ok: true; moved: number; skipped: number } | Fail> {
  const plan = await db.degreeFeePlan.findFirst({ where: { id: planId, lodgeId }, include: PLAN_INCLUDE });
  if (!plan || plan.status !== 'active') return { ok: false, status: 404, error: 'Plano ativo não encontrado.' };
  if (!plan.expectedEventDate) return { ok: false, status: 400, error: 'Informe antes a data prevista do evento.' };
  const event = plan.expectedEventDate;
  let moved = 0, skipped = 0;
  // Cartão: o Asaas cobra o parcelamento inteiro de uma vez no cartão — não há o que antecipar.
  if (plan.paymentMethod === 'card') return { ok: true, moved: 0, skipped: 0 };
  for (const a of plan.accounts) {
    const paid = a.payments.reduce((s, x) => s + Number(x.amount), 0);
    if (a.status === 'paid' || paid >= Number(a.amount) || a.dueDate.getTime() <= event.getTime()) continue;
    if (a.invoices.some((i) => i.asaasPaymentId)) { skipped++; continue; }
    await db.account.update({ where: { id: a.id }, data: { dueDate: event } });
    await db.invoice.updateMany({ where: { accountId: a.id, lodgeId }, data: { dueDate: event } });
    moved++;
  }
  await logAudit(db, { lodgeId, userId, action: 'UPDATE', entity: 'degreeFeePlan', entityId: planId, metadata: { anticipatedTo: event.toISOString().slice(0, 10), moved, skipped } });
  return { ok: true, moved, skipped };
}

/** Cotas em aberto já emitidas no Asaas (o cancelamento as apaga lá ANTES de mexer no banco). */
export async function emittedOpenCotas(db: Db, lodgeId: string, planId: string): Promise<string[]> {
  const invoices = await db.invoice.findMany({
    where: { lodgeId, status: { not: 'paid' }, asaasPaymentId: { not: null }, account: { degreeFeePlanId: planId, status: { not: 'paid' } } },
    select: { asaasPaymentId: true },
  });
  return invoices.map((i) => i.asaasPaymentId!).filter(Boolean);
}

/**
 * Cancela o plano (o evento não vai acontecer): as cotas em aberto saem e, se o
 * irmão já pagou algo, nasce uma conta a pagar ("A Loja me deve") com a devolução,
 * na categoria 2.1.17 — segue o visto do Venerável como qualquer despesa.
 */
export async function cancelPlan(db: Db, input: { lodgeId: string; planId: string; userId: string; reason: string }): Promise<{ ok: true; refund: number } | Fail> {
  const { lodgeId, planId } = input;
  const plan = await db.degreeFeePlan.findFirst({ where: { id: planId, lodgeId }, include: PLAN_INCLUDE });
  if (!plan) return { ok: false, status: 404, error: 'Plano não encontrado.' };
  if (plan.status !== 'active') return { ok: false, status: 409, error: 'O plano já está cancelado.' };
  const def = degreeFeeKind(plan.kind)!;

  let refundCents = 0;
  for (const a of plan.accounts) {
    const paidCents = a.payments.reduce((s, x) => s + Math.round(Number(x.amount) * 100), 0);
    const fullyPaid = a.status === 'paid' || paidCents >= Math.round(Number(a.amount) * 100);
    if (paidCents > 0 && !fullyPaid) {
      return { ok: false, status: 409, error: `A cota "${a.title}" tem pagamento parcial. Registre o restante (ou estorne o pagamento) antes de cancelar.` };
    }
    refundCents += paidCents;
  }
  const refundChartId = refundCents > 0 ? await ensureChart(db, lodgeId, DEGREE_FEE_REFUND_CHART) : null;
  if (refundCents > 0 && !refundChartId) return chartConflict(DEGREE_FEE_REFUND_CHART);

  for (const a of plan.accounts) {
    if (a.payments.length > 0) continue;
    await db.invoice.deleteMany({ where: { accountId: a.id, lodgeId } });
    await db.account.delete({ where: { id: a.id } });
  }

  let refundAccountId: string | null = null;
  const refund = refundCents / 100;
  if (refundCents > 0) {
    const chartAccountId = refundChartId;
    const lodge = await db.lodge.findUnique({ where: { id: lodgeId }, select: { expenseApprovalThreshold: true } });
    const threshold = lodge?.expenseApprovalThreshold;
    const today = new Date();
    const created = await db.account.create({
      data: {
        lodgeId, type: 'PAYABLE', title: `Devolução — ${def.label}`, amount: refund,
        dueDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
        description: `Devolução do que foi pago no plano da ${def.label.toLowerCase()}. Motivo: ${input.reason}`,
        memberId: plan.memberId, chartAccountId, degreeFeePlanId: plan.id,
        approvalStatus: threshold != null && refund >= threshold ? 'pending' : 'approved',
      },
      select: { id: true },
    });
    refundAccountId = created.id;
  }
  await db.degreeFeePlan.update({ where: { id: planId }, data: { status: 'canceled', canceledAt: new Date(), cancelReason: input.reason, refundAccountId } });
  await logAudit(db, { lodgeId, userId: input.userId, action: 'UPDATE', entity: 'degreeFeePlan', entityId: planId, metadata: { canceled: input.reason, refund } });
  return { ok: true, refund };
}

export const DEGREE_FEE_KINDS_ORDER: DegreeFeeKind[] = ['initiation', 'elevation', 'exaltation', 'affiliation'];

/**
 * Fase 2: emite no Asaas o parcelamento no cartão do plano recém-criado e liga cada parcela
 * do Asaas a uma cota (Invoice.asaasPaymentId + link). Rede fora de transação. Se o Asaas
 * recusar, o plano é desfeito — nada fica meio criado.
 */
export async function emitCardInstallment(lodgeId: string, planId: string): Promise<{ ok: true; url: string | null } | Fail> {
  const ctx = await withTenant(lodgeId, async (db) => ({
    lodge: await db.lodge.findUnique({ where: { id: lodgeId }, select: { asaasApiKeyEnc: true, asaasEnv: true } }),
    plan: await db.degreeFeePlan.findFirst({
      where: { id: planId, lodgeId },
      include: {
        member: { select: { id: true, name: true, email: true, phone: true, cpf: true, asaasCustomerId: true } },
        accounts: { where: { type: 'RECEIVABLE' }, select: { id: true, title: true, amount: true, dueDate: true, invoices: { select: { id: true } } }, orderBy: { dueDate: 'asc' } },
      },
    }),
  }));
  const config = buildLodgeAsaasConfig(ctx.lodge);
  const plan = ctx.plan;
  if (!config || !plan) return { ok: false, status: 409, error: 'Asaas não conectado ou plano não encontrado.' };
  const def = degreeFeeKind(plan.kind)!;

  let installmentId: string | null = null;
  try {
    let customerId = plan.member.asaasCustomerId;
    if (!customerId) {
      const customer = await createCustomer(config, { name: plan.member.name, email: plan.member.email ?? undefined, cpfCnpj: plan.member.cpf!, phone: plan.member.phone ?? undefined });
      customerId = customer?.id ?? null;
      if (!customerId) throw new Error('Falha ao criar o cliente no Asaas.');
      await withTenant(lodgeId, (db) => db.member.update({ where: { id: plan.member.id }, data: { asaasCustomerId: customerId } }));
    }
    const created = await createInstallment(config, {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      installmentCount: plan.installments,
      value: Number(plan.accounts[0].amount),
      dueDate: plan.firstDueDate.toISOString().slice(0, 10),
      description: `${def.label} — ${plan.installments}x no cartão`,
      externalReference: `${DEGREE_FEE_CARD_REF_PREFIX}${plan.id}`,
    });
    installmentId = created.id;
    const payments = (await listInstallmentPayments(config, created.id)).sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0) || a.dueDate.localeCompare(b.dueDate));
    if (payments.length !== plan.accounts.length) throw new Error(`O Asaas gerou ${payments.length} parcelas para ${plan.accounts.length} cotas.`);

    await withTenant(lodgeId, async (db) => {
      for (const [i, a] of plan.accounts.entries()) {
        const pay = payments[i];
        const due = new Date(`${pay.dueDate}T00:00:00.000Z`);
        await db.account.update({ where: { id: a.id }, data: { dueDate: due } });
        await db.invoice.updateMany({ where: { accountId: a.id, lodgeId }, data: { asaasPaymentId: pay.id, asaasInvoiceUrl: pay.invoiceUrl ?? null, dueDate: due } });
      }
      await db.degreeFeePlan.update({ where: { id: plan.id }, data: { asaasInstallmentId: created.id } });
    });
    return { ok: true, url: payments[0]?.invoiceUrl ?? null };
  } catch (error) {
    if (installmentId) await deleteInstallment(config, installmentId).catch(() => {});
    await withTenant(lodgeId, async (db) => {
      await db.invoice.deleteMany({ where: { lodgeId, account: { degreeFeePlanId: plan.id } } });
      await db.account.deleteMany({ where: { lodgeId, degreeFeePlanId: plan.id } });
      await db.degreeFeePlan.delete({ where: { id: plan.id } });
    });
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 502, error: `O Asaas não criou o parcelamento no cartão (${message}). Nada foi gravado — tente de novo.` };
  }
}
