import type { Prisma } from '@/generated/prisma/client';
import { logAudit } from '@/lib/audit';
import { nextInvoiceNumbers } from '@/lib/charges';
import { findClosedTermForDate } from '@/lib/term-lock';
import { isValidMoney } from '@/lib/money';
import {
  DEGREE_FEE_REFUND_CHART, MAX_INSTALLMENTS, checkEligibility, degreeFeeKind, installmentTitle, splitInstallments, summarizePlan,
  type DegreeFeeKind,
} from '@/lib/degree-fee';

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

  const lodge = await db.lodge.findUnique({ where: { id: input.lodgeId }, select: { initiationFee: true, elevationFee: true, exaltationFee: true, affiliationFee: true } });
  const total = lodge?.[def.lodgeField] ?? null;
  if (total == null || !isValidMoney(total)) {
    return { ok: false, status: 400, error: `Configure o valor da ${def.label.toLowerCase()} em Configurações da loja → Financeiro.` };
  }

  const member = await db.member.findFirst({
    where: { id: input.memberId, lodgeId: input.lodgeId },
    select: { id: true, name: true, status: true, initiationDate: true, elevationDate: true, exaltationDate: true, installationDate: true },
  });
  if (!member) return { ok: false, status: 404, error: 'Irmão não encontrado.' };
  const eligible = checkEligibility(def.kind, member, input.fourthInstructionDate);
  if (!eligible.ok) return { ok: false, status: 400, error: eligible.error };

  const existing = await db.degreeFeePlan.findFirst({ where: { lodgeId: input.lodgeId, memberId: member.id, kind: def.kind, status: 'active' }, select: { id: true } });
  if (existing) return { ok: false, status: 409, error: `${member.name} já tem um plano ativo da ${def.label.toLowerCase()}.` };

  const locked = await findClosedTermForDate(db, input.lodgeId, input.firstDueDate);
  if (locked) return { ok: false, status: 409, error: `Período encerrado (${locked.title}). Escolha um vencimento depois do veneralato fechado.` };

  const chartAccountId = await ensureChart(db, input.lodgeId, def.chart);
  if (!chartAccountId) return chartConflict(def.chart);
  const cotas = splitInstallments(total, n, input.firstDueDate);
  const plan = await db.degreeFeePlan.create({
    data: {
      lodgeId: input.lodgeId,
      memberId: member.id,
      kind: def.kind,
      totalAmount: total,
      installments: n,
      firstDueDate: input.firstDueDate,
      fourthInstructionDate: def.kind === 'elevation' || def.kind === 'exaltation' ? input.fourthInstructionDate : null,
      notes: input.notes?.trim() || null,
      createdById: input.userId,
    },
    select: { id: true },
  });
  const numbers = await nextInvoiceNumbers(db, input.lodgeId, n);
  const description = `Plano da ${def.label.toLowerCase()}: deve estar quitada até a data da ${def.event}.`;
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
  await logAudit(db, { lodgeId: input.lodgeId, userId: input.userId, action: 'CREATE', entity: 'degreeFeePlan', entityId: plan.id, metadata: { member: member.name, kind: def.kind, total, installments: n } });
  return { ok: true, planId: plan.id };
}

export const PLAN_INCLUDE = {
  member: { select: { id: true, name: true, status: true, cpf: true, initiationDate: true, elevationDate: true, exaltationDate: true } },
  accounts: {
    where: { type: 'RECEIVABLE' },
    select: {
      id: true, title: true, amount: true, dueDate: true, status: true,
      payments: { select: { amount: true, paidAt: true } },
      invoices: { select: { id: true, number: true, asaasPaymentId: true, status: true } },
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
