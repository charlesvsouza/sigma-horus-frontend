// "Dividir pagamento": separa partes de um recebimento já lançado — típico do saldo de abertura, que entra num
// lançamento só (1.5.04) mas inclui o Tronco e mensalidades adiantadas dos irmãos. A soma e a conta bancária
// NÃO mudam (o saldo do banco continua igual): o pagamento original diminui e cada parte vira
//   • um lançamento novo, já recebido, em outra categoria (ex.: Tronco de Beneficência); ou
//   • baixa das cobranças em aberto de um irmão, da mais antiga para a mais nova (a mensalidade adiantada).
// Tudo na mesma transação; passa pelas mesmas travas (veneralato encerrado, livro conferido).
import type { Prisma } from '@/generated/prisma/client';
import { brl } from '@/lib/currency';
import { formatDateOnly } from '@/lib/date-only';
import { dayKeyToDate, isDayKey } from '@/lib/ledger-day';
import { lockKey } from '@/lib/locks';
import { coversAmount, isValidMoney, remainingAmount, round2 } from '@/lib/money';
import { findOpenAsaasCharges } from '@/lib/asaas-manual';
import { editPayment, resyncAccountAfterPaymentChange } from '@/lib/payment-edit-server';
import { autoSignReceipt } from '@/lib/receipt-signature-server';
import { checkLedgerOpen } from '@/lib/ledger-lock-server';
import { allocateOldestFirst } from '@/lib/split-allocation';
import { findClosedTermForDate } from '@/lib/term-lock';

const NOT_SPLITTABLE_METHODS = new Set(['asaas', 'asaas-cash', 'asaas-fee', 'asaas-refund', 'donation', 'fund']);

type Db = Prisma.TransactionClient;

export type SplitPartInput =
  | { kind: 'category'; chartAccountId: string; amount: number; title?: string }
  | { kind: 'member'; memberId: string; amount: number; paidOn?: string };

export interface SplitPlanLine {
  kind: 'category' | 'member';
  label: string;
  amount: number;
  /** Para kind=member: as cobranças que recebem a baixa. */
  allocations?: { accountId: string; title: string; dueDate: string; amount: number; remainingAfter: number }[];
}

export interface SplitPlan {
  source: { paymentId: string; title: string; amount: number; paidAt: string };
  lines: SplitPlanLine[];
  total: number;
  leftover: number;
}

export type SplitResult = { ok: true; plan: SplitPlan; applied: boolean } | { ok: false; status: number; error: string };

const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

export async function splitPayment(
  db: Db,
  p: { lodgeId: string; paymentId: string; parts: SplitPartInput[]; note?: string | null; user: { id: string }; apply: boolean },
): Promise<SplitResult> {
  const { lodgeId, paymentId, user } = p;
  if (p.parts.length === 0) return fail(400, 'Informe pelo menos uma parte a separar.');
  const payment = await db.payment.findFirst({ where: { id: paymentId, lodgeId }, include: { account: true } });
  if (!payment) return fail(404, 'Pagamento não encontrado.');
  await lockKey(db, `account:${payment.accountId}`);

  const source = payment.account;
  if (source.type !== 'RECEIVABLE') return fail(409, 'Só se divide um recebimento (entrada).');
  if (!payment.bankAccountId) return fail(409, 'Este pagamento não tem conta bancária/caixa: informe a conta antes de dividir.');
  const siblings = await db.payment.count({ where: { accountId: source.id } });
  if (siblings !== 1 || !coversAmount(Number(payment.amount), Number(source.amount)) || !coversAmount(Number(source.amount), Number(payment.amount))) {
    return fail(409, 'Só se divide um lançamento recebido de uma vez (um único pagamento com o valor inteiro do lançamento).');
  }
  const day = payment.paidAt;
  const paidAtText = formatDateOnly(day);

  // ---- monta o plano (sem gravar) ----
  const lines: SplitPlanLine[] = [];
  const writes: ({ kind: 'category'; chartId: string; title: string; amount: number } | { kind: 'member'; memberId: string; allocations: { accountId: string; amount: number }[]; paidOn?: string })[] = [];
  const usedAccounts = new Set<string>();
  for (const part of p.parts) {
    const amount = round2(Number(part.amount));
    if (!isValidMoney(amount)) return fail(400, 'Cada parte precisa ter um valor maior que zero, com até 2 casas decimais.');
    if (part.kind === 'category') {
      const chart = await db.chartAccount.findFirst({ where: { id: part.chartAccountId, lodgeId }, select: { id: true, name: true, code: true, type: true } });
      if (!chart) return fail(400, 'Categoria não encontrada.');
      if (chart.type !== 'REVENUE') return fail(400, `A categoria "${chart.name}" é de despesa: escolha uma categoria de receita.`);
      lines.push({ kind: 'category', label: `${chart.code} ${chart.name}`, amount });
      writes.push({ kind: 'category', chartId: chart.id, title: part.title?.trim() || chart.name, amount });
    } else {
      const member = await db.member.findFirst({ where: { id: part.memberId, lodgeId }, select: { id: true, name: true } });
      if (!member) return fail(400, 'Irmão não encontrado nesta loja.');
      if (part.paidOn && !isDayKey(part.paidOn)) return fail(400, 'A data do adiantamento é inválida.');
      const accounts = await db.account.findMany({
        where: { lodgeId, memberId: member.id, type: 'RECEIVABLE', status: { not: 'paid' }, approvalStatus: 'approved', id: { notIn: [...usedAccounts] } },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, title: true, amount: true, dueDate: true, payments: { select: { amount: true } } },
      });
      const open = accounts
        .map((a) => ({ accountId: a.id, title: a.title, dueDate: a.dueDate, remaining: remainingAmount(Number(a.amount), a.payments.reduce((s, x) => s + Number(x.amount), 0)) }))
        .filter((a) => a.remaining > 0);
      const { allocations, unallocated } = allocateOldestFirst(open, amount);
      if (unallocated > 0) {
        const totalOpen = round2(open.reduce((s, o) => s + o.remaining, 0));
        return fail(409, `${member.name}: ${brl(amount)} é mais do que as cobranças em aberto dele (${brl(totalOpen)}). Gere as mensalidades dos meses cobertos antes de dividir.`);
      }
      for (const a of allocations) {
        const charges = await findOpenAsaasCharges(db, { accountId: a.accountId, memberId: member.id });
        if (charges.length > 0) return fail(409, `${member.name}: a cobrança "${a.title}" está aberta no Asaas (${charges.map((c) => c.number).join(', ')}). Cancele-a lá antes de dar a baixa por aqui.`);
        usedAccounts.add(a.accountId);
      }
      lines.push({
        kind: 'member', label: member.name, amount,
        allocations: allocations.map((a) => ({ accountId: a.accountId, title: a.title, dueDate: a.dueDate.toISOString().slice(0, 10), amount: a.amount, remainingAfter: a.remainingAfter })),
      });
      writes.push({ kind: 'member', memberId: member.id, allocations: allocations.map((a) => ({ accountId: a.accountId, amount: a.amount })), paidOn: part.paidOn });
    }
  }
  const total = round2(lines.reduce((s, l) => s + l.amount, 0));
  const leftover = round2(Number(payment.amount) - total);
  if (leftover <= 0) return fail(400, `As partes (${brl(total)}) precisam ser menores que o recebimento (${brl(Number(payment.amount))}): o que sobra continua no lançamento original.`);
  const plan: SplitPlan = { source: { paymentId: payment.id, title: source.title, amount: Number(payment.amount), paidAt: day.toISOString().slice(0, 10) }, lines, total, leftover };
  if (!p.apply) {
    // Prévia: já confere as travas, para o Tesoureiro saber antes de tentar.
    if (NOT_SPLITTABLE_METHODS.has(payment.method)) return fail(409, 'Este recebimento nasceu de outro fluxo (Asaas, doação ou custeio) e não se divide. Estorne e lance de novo, se preciso.');
    const term = await findClosedTermForDate(db, lodgeId, day);
    if (term) return fail(409, `Período encerrado (${term.title}). Não é possível alterar pagamento dentro de um veneralato já fechado.`);
    const gate = await checkLedgerOpen(db, lodgeId, [day], { dryRun: true });
    if (!gate.ok) return fail(409, gate.error);
    return { ok: true, plan, applied: false };
  }

  // ---- aplica ----
  const reduce = await editPayment(db, { lodgeId, paymentId, patch: { amount: leftover }, user, accountAmount: leftover });
  if (!reduce.ok) return fail(reduce.status, reduce.error);
  await db.account.update({ where: { id: source.id }, data: { amount: leftover } });

  const method = payment.method;
  const origin = `Parte do recebimento "${source.title}" de ${paidAtText}`;
  const extra = p.note?.trim() ? ` — ${p.note.trim()}` : '';
  for (const w of writes) {
    if (w.kind === 'category') {
      const account = await db.account.create({
        data: {
          lodgeId, type: 'RECEIVABLE', title: w.title, amount: w.amount, dueDate: day, status: 'paid', chartAccountId: w.chartId,
          bankAccountId: payment.bankAccountId, description: `${origin}${extra}`,
        },
        select: { id: true },
      });
      const created = await db.payment.create({
        data: { lodgeId, accountId: account.id, memberId: null, bankAccountId: payment.bankAccountId, amount: w.amount, paidAt: day, method, note: `${origin}${extra}` },
        select: { id: true },
      });
      await autoSignReceipt(db, lodgeId, created.id, user.id);
    } else {
      for (const a of w.allocations) {
        const paidOnText = w.paidOn ? ` (pago em ${formatDateOnly(dayKeyToDate(w.paidOn))})` : '';
        const created = await db.payment.create({
          data: { lodgeId, accountId: a.accountId, memberId: w.memberId, bankAccountId: payment.bankAccountId, amount: a.amount, paidAt: day, method, note: `Adiantamento incluído no saldo — ${origin}${paidOnText}${extra}` },
          select: { id: true },
        });
        await resyncAccountAfterPaymentChange(db, lodgeId, a.accountId, w.memberId);
        await autoSignReceipt(db, lodgeId, created.id, user.id);
      }
    }
  }
  return { ok: true, plan, applied: true };
}
